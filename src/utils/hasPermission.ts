const hasPermission = (userPermissions, permissionsNeeded) => {
  // TODO: Everybody has permission for now
  return;
  const matchedPermissions = userPermissions.filter((permissionTheyHave) =>
    permissionsNeeded.includes(permissionTheyHave)
  );
  if (!matchedPermissions.length) {
    throw new Error(`You do not have sufficient permissions
      : ${permissionsNeeded}
      You Have:
      ${userPermissions}
      `);
  }
};

export default hasPermission;