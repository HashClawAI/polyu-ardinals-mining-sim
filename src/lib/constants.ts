/** Naming for Mining Simulation · PolyU AF5644 — cookies and browser storage */
export const STUDENT_COOKIE_NAME = "polyu_af5644_student_id";

const STORAGE_PREFIX = "polyu_af5644";

export const lsKey = {
  clientSecret: (studentId: string) => `${STORAGE_PREFIX}_client_secret:${studentId}`,
  nonce: (epochId: string) => `${STORAGE_PREFIX}_nonce:${epochId}`,
  commitMaterial: (studentId: string) => `${STORAGE_PREFIX}_commit_material:${studentId}`,
  autoRevealDone: (studentId: string, epochId: string) =>
    `${STORAGE_PREFIX}_auto_reveal_done:${studentId}:${epochId}`,
};
