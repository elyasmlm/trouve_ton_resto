import { useCallback, useEffect, useState } from 'react'
import { storage } from '../api/client.js'

export const GEO_TEXT = {
  asking: 'Recherche de ta position…',
  denied: 'Position refusée. Tu peux l’autoriser dans les réglages de ton navigateur.',
  error: 'Impossible de te localiser pour l’instant.',
  unavailable: 'Ton navigateur ne gère pas la géolocalisation.',
}

const KEY = 'ttr_geo'
const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

// Position de l'utilisateur. Rien n'est demandé tant qu'il n'a pas cliqué ;
// s'il a déjà accepté, on la redemande silencieusement aux visites suivantes.
// Les coordonnées sont arrondies (~100 m) : inutile d'envoyer plus précis.
export function useGeolocation() {
  const [state, setState] = useState({
    status: !supported ? 'unavailable' : storage.get(KEY) === '1' ? 'asking' : 'idle',
    coords: null,
  })

  const request = useCallback(() => {
    if (!supported) return
    setState((s) => ({ ...s, status: 'asking' }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        storage.set(KEY, '1')
        setState({
          status: 'granted',
          coords: { lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 },
        })
      },
      (err) => {
        storage.remove(KEY)
        setState({ status: err.code === 1 ? 'denied' : 'error', coords: null })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }, [])

  const clear = useCallback(() => {
    storage.remove(KEY)
    setState({ status: 'idle', coords: null })
  }, [])

  useEffect(() => {
    if (supported && storage.get(KEY) === '1') request()
  }, [request])

  return { ...state, request, clear }
}