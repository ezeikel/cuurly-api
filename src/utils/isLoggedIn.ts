const isLoggedIn = (userId: string) => {
  if (!userId) {
    throw new Error('You must be logged in to do that.');
  }
};

export default isLoggedIn;
