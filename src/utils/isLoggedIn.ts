const isLoggedIn = userId => {
  if (!userId) {
    throw new Error('You must be logged in to do that.');
  }
};

export default isLoggedIn;
