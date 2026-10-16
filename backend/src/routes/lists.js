const express = require('express');
const mongoose = require('mongoose');
const List = require('../models/List');
const { notify } = require('../services/notifications');
const Resto = require('../models/Resto');
const User = require('../models/User');
const { requireAuth, httpError } = require('../middleware/auth');
const { ensureDefaultLists } = require('../services/lists');

const router = express.Router();

const MAX_CUSTOM_LISTS = 50;
const MAX_RESTOS = 500;
const MAX_COLLABORATORS = 10;
const ORDER = { wishlist: 0, eatenlist: 1, custom: 2 };

const populateList = (query) => query.populate('user', 'username').populate('collaborators', 'username');
const sameId = (a, b) => String(a) === String(b);

function serialize(list, userId) {
  const l = typeof list.toObject === 'function' ? list.toObject() : list;
  return {
    _id: l._id,
    name: l.name,
    type: l.type,
    is_public: l.is_public,
    count: l.restos.length,
    restos: l.restos.map((r) => String(r._id || r)),
    owner: { _id: l.user._id, username: l.user.username },
    collaborators: l.collaborators.map((c) => ({ _id: c._id, username: c.username })),
    is_owner: Boolean(userId) && sameId(l.user._id, userId),
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

const reload = async (id, userId) => serialize(await populateList(List.findById(id)), userId);

// Charge la liste et calcule les droits. Une liste privée inaccessible répond 404 (on ne révèle pas son existence).
async function loadList(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'List not found');
    const list = await populateList(List.findById(req.params.id));
    if (!list) throw httpError(404, 'List not found');
    const uid = req.user && req.user._id;
    req.list = list;
    req.isOwner = Boolean(uid) && sameId(list.user._id, uid);
    req.canWrite = req.isOwner || (Boolean(uid) && list.collaborators.some((c) => sameId(c._id, uid)));
    if (!req.canWrite && !list.is_public) throw httpError(404, 'List not found');
    next();
  } catch (err) {
    next(err);
  }
}

const requireWrite = (req, res, next) => (req.canWrite ? next() : next(httpError(req.user ? 403 : 401, 'Forbidden')));
const requireOwner = (req, res, next) => (req.isOwner ? next() : next(httpError(req.user ? 403 : 401, 'Only the owner can do this')));
const requireCustom = (req, res, next) => (req.list.type === 'custom' ? next() : next(httpError(400, 'This is a default list')));

// Mes listes (et celles où je collabore). Les listes par défaut sont créées au besoin.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    await ensureDefaultLists(req.user._id);
    const lists = await populateList(List.find({ $or: [{ user: req.user._id }, { collaborators: req.user._id }] }));
    const items = lists
      .map((l) => serialize(l, req.user._id))
      .sort((a, b) => ORDER[a.type] - ORDER[b.type] || new Date(b.updated_at) - new Date(a.updated_at));
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 40) throw httpError(400, 'name must be 1 to 40 characters');
    if ((await List.countDocuments({ user: req.user._id, type: 'custom' })) >= MAX_CUSTOM_LISTS) {
      throw httpError(400, `You can have up to ${MAX_CUSTOM_LISTS} custom lists`);
    }
    const list = await List.create({ user: req.user._id, name, type: 'custom', is_public: req.body.is_public === true });
    res.status(201).json({ list: await reload(list._id, req.user._id) });
  } catch (err) {
    if (err.code === 11000) return next(httpError(409, 'You already have a list with this name'));
    next(err);
  }
});

// Détail : accessible au propriétaire, aux collaborateurs et à tous si la liste est publique
router.get('/:id', loadList, async (req, res, next) => {
  try {
    const uid = req.user && req.user._id;
    const docs = await Resto.find({ _id: { $in: req.list.restos } }).lean();
    const byId = new Map(docs.map((r) => [String(r._id), r]));
    const restos = req.list.restos.map((id) => byId.get(String(id))).filter(Boolean);
    res.json({ list: serialize(req.list, uid), restos, can_write: req.canWrite });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, loadList, requireOwner, async (req, res, next) => {
  try {
    const { name, is_public: isPublic } = req.body || {};
    if (name !== undefined) {
      if (req.list.type !== 'custom') throw httpError(400, 'Default lists cannot be renamed');
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) throw httpError(400, 'name must be 1 to 40 characters');
      req.list.name = name.trim();
    }
    if (isPublic !== undefined) {
      if (typeof isPublic !== 'boolean') throw httpError(400, 'is_public must be a boolean');
      req.list.is_public = isPublic;
    }
    await req.list.save();
    res.json({ list: await reload(req.list._id, req.user._id) });
  } catch (err) {
    if (err.code === 11000) return next(httpError(409, 'You already have a list with this name'));
    next(err);
  }
});

router.delete('/:id', requireAuth, loadList, requireOwner, requireCustom, async (req, res, next) => {
  try {
    await req.list.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Ajouter un resto (sans doublon)
router.post('/:id/restos', requireAuth, loadList, requireWrite, async (req, res, next) => {
  try {
    const id = req.body?.resto;
    if (!mongoose.isValidObjectId(id)) throw httpError(400, 'resto must be a valid id');
    if (!(await Resto.exists({ _id: id }))) throw httpError(404, 'Resto not found');
    if (req.list.restos.length >= MAX_RESTOS && !req.list.restos.some((r) => sameId(r, id))) {
      throw httpError(400, `A list can hold up to ${MAX_RESTOS} restos`);
    }
    await List.updateOne({ _id: req.list._id }, { $addToSet: { restos: id } });
    res.json({ list: await reload(req.list._id, req.user._id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/restos/:restoId', requireAuth, loadList, requireWrite, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.restoId)) throw httpError(404, 'Resto not found');
    await List.updateOne({ _id: req.list._id }, { $pull: { restos: req.params.restoId } });
    res.json({ list: await reload(req.list._id, req.user._id) });
  } catch (err) {
    next(err);
  }
});

// Collaborateurs (listes personnalisées uniquement), ajoutés par pseudo
router.post('/:id/collaborators', requireAuth, loadList, requireOwner, requireCustom, async (req, res, next) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (!username) throw httpError(400, 'username is required');
    const other = await User.findOne({ username }).select('_id');
    if (!other) throw httpError(404, 'User not found');
    if (sameId(other._id, req.user._id)) throw httpError(400, 'You are already the owner');
    if (req.list.collaborators.length >= MAX_COLLABORATORS && !req.list.collaborators.some((c) => sameId(c._id, other._id))) {
      throw httpError(400, `A list can have up to ${MAX_COLLABORATORS} collaborators`);
    }
    const isNew = !req.list.collaborators.some((c) => sameId(c._id, other._id));
    await List.updateOne({ _id: req.list._id }, { $addToSet: { collaborators: other._id } });
    if (isNew) await notify(other._id, 'list_invite', `${req.user.username} t’a invité à la liste « ${req.list.name} ».`, { list: req.list._id });
    res.json({ list: await reload(req.list._id, req.user._id) });
  } catch (err) {
    next(err);
  }
});

// Le propriétaire retire n'importe qui ; un collaborateur peut se retirer lui-même
router.delete('/:id/collaborators/:userId', requireAuth, loadList, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) throw httpError(404, 'User not found');
    if (!req.isOwner && !sameId(userId, req.user._id)) throw httpError(403, 'Forbidden');
    await List.updateOne({ _id: req.list._id }, { $pull: { collaborators: userId } });
    if (!req.isOwner) return res.status(204).end();
    res.json({ list: await reload(req.list._id, req.user._id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;