import { useContext } from 'react'
import { ListsContext } from './ListsContext.js'

export function useLists() {
  const context = useContext(ListsContext)
  if (!context) throw new Error('useLists doit être utilisé dans <ListsProvider>')
  return context
}