export function isAdminUser(userDoc) {
  return userDoc?.role === "admin";
}

export function buildReqUser(userDoc) {
  return {
    id: userDoc._id,
    email: userDoc.email,
    isAdmin: isAdminUser(userDoc),
  };
}
