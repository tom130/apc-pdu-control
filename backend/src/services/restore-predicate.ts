export function shouldRestore(outlet: {
  desiredState: string | null;
  actualState: string | null;
  autoRecovery: boolean | null;
}): boolean {
  if (outlet.autoRecovery !== true) return false;
  if (outlet.desiredState !== 'on' && outlet.desiredState !== 'off') return false;
  return outlet.desiredState !== outlet.actualState;
}
