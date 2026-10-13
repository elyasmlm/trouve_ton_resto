import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Account from './pages/Account.jsx'
import Preferences from './pages/Preferences.jsx'
import Lists from './pages/Lists.jsx'
import ListDetail from './pages/ListDetail.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import NotFound from './pages/NotFound.jsx'
import { BellIcon, PlusIcon, SearchIcon } from './components/Icons.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="recherche"
          element={
            <ComingSoon
              icon={SearchIcon}
              title="La recherche arrive"
              text="Bientôt, tu pourras filtrer par cuisine, prix, distance et même par ce qui est ouvert maintenant."
            />
          }
        />
        <Route
          path="ajouter"
          element={
            <RequireAuth>
              <ComingSoon
                icon={PlusIcon}
                title="Ajouter un resto"
                text="Tu connais une bonne adresse qui n’est pas encore là ? Bientôt, tu pourras la partager en deux minutes."
              />
            </RequireAuth>
          }
        />
        <Route
          path="listes"
          element={
            <RequireAuth>
              <Lists />
            </RequireAuth>
          }
        />
        <Route path="listes/:id" element={<ListDetail />} />
        <Route
          path="notifications"
          element={
            <RequireAuth>
              <ComingSoon
                icon={BellIcon}
                title="Notifications"
                text="Tu seras prévenu ici quand un resto répond à ton avis ou qu’un badge se débloque."
              />
            </RequireAuth>
          }
        />
        <Route
          path="compte"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="preferences"
          element={
            <RequireAuth>
              <Preferences />
            </RequireAuth>
          }
        />
        <Route path="connexion" element={<Login />} />
        <Route path="inscription" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}