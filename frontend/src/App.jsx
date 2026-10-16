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
import AddResto from './pages/AddResto.jsx'
import Admin from './pages/Admin.jsx'
import EditResto from './pages/EditResto.jsx'
import RestoDetail from './pages/RestoDetail.jsx'
import Notifications from './pages/Notifications.jsx'
import NotFound from './pages/NotFound.jsx'
import Search from './pages/Search.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="recherche" element={<Search />} />
        <Route
          path="ajouter"
          element={
            <RequireAuth>
              <AddResto />
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
        <Route path="restos/:id" element={<RestoDetail />} />
        <Route
          path="restos/:id/modifier"
          element={
            <RequireAuth>
              <EditResto />
            </RequireAuth>
          }
        />
        <Route
          path="notifications"
          element={
            <RequireAuth>
              <Notifications />
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
        <Route
          path="admin"
          element={
            <RequireAuth>
              <Admin />
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