/**
 * Estratégia: last-write-wins por updated_at.
 * Se o registro local nunca foi editado offline (_synced = true),
 * o remoto vence sempre — sem conflito real.
 */
export function resolveConflict<T extends { id: string; updated_at: string; _synced: boolean }>(
  local: T,
  remote: T
): T {
  if (local._synced) {
    return remote
  }

  const localTime = new Date(local.updated_at || 0).getTime()
  const remoteTime = new Date(remote.updated_at || 0).getTime()

  if (remoteTime > localTime) {
    console.warn(`[Conflict] Remoto mais recente venceu. id=${local.id}`)
    return remote
  }

  console.info(`[Conflict] Local mais recente mantido. id=${local.id}`)
  return { ...local, _synced: false }
}
