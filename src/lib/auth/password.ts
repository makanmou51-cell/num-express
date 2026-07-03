import bcrypt from "bcryptjs";

const ROUNDS = 10;

// Hash factice (valide) : sert à exécuter un bcrypt.compare de durée équivalente
// quand l'e-mail n'existe pas, pour ne pas révéler l'existence via le timing.
export const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
