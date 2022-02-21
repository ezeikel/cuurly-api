import { Context } from '../context';
import { isLoggedIn } from '../utils';

type UsersArgs = {
  query?: string;
};

type UserArgs = {
  id: string;
  username: string;
  email: string;
};

type FollowingArgs = {
  id?: string;
  username?: string;
  email?: string;
};

type FollowersArgs = {
  id?: string;
  username?: string;
  email?: string;
};

type PostArgs = {
  id: string;
};

type FeedArgs = {
  id: string;
};

type ExploreArgs = {
  id: string;
};

type LikedPostsArgs = {
  id: string;
};

const Query = {
  currentUser: (parent: any, args: any, context: Context) => {
    if (!context.user) {
      return null;
    }

    return context.prisma.user.findUnique({
      where: {
        id: context.user.id,
      },
    });
  },
  users: (parent: any, { query }: UsersArgs, context: Context) => {
    isLoggedIn(context.user?.id);
    let filter = {};

    if (query) {
      filter = {
        // just filtering on username for now until OR is added back for mongo connector - https://github.com/prisma/prisma/issues/3897
        where: {
          username: {
            contains: query,
          },
        },
      };
    }

    return context.prisma.user.findMany(filter);
  },
  user: (parent: any, { id, username, email }: UserArgs, context: Context) =>
    context.prisma.user.findUnique({ where: { id, username, email } }),
  following: (
    parent: any,
    { id, username, email }: FollowingArgs,
    context: Context,
  ) =>
    context.prisma.user
      .findUnique({ where: { id, username, email } })
      .following(),
  followers: (
    parent: any,
    { id, username, email }: FollowersArgs,
    context: Context,
  ) =>
    context.prisma.user
      .findUnique({ where: { id, username, email } })
      .followers(),
  posts: (parent: any, args: any, context: Context) =>
    context.prisma.user.findMany(),
  post: (parent: any, { id }: PostArgs, context: Context) =>
    context.prisma.post.findUnique({ where: { id } }),
  feed: async (
    parent: any,
    { id }: FeedArgs,
    { prisma, user: { id: userId } }: Context,
  ) => {
    const following = await prisma.user
      .findUnique({ where: { id } })
      .following();
    const followingIds = following.map(follower => follower.id);

    return prisma.post.findMany({
      where: {
        author: { is: { id: { in: [...followingIds, userId] } } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
  explore: async (
    parent: any,
    { id }: ExploreArgs,
    { prisma, user: { id: userId } }: Context,
  ) => {
    const following = await prisma.user
      .findUnique({ where: { id } })
      .following();
    const followingIds = following.map(follower => follower.id);

    return prisma.post.findMany({
      where: {
        author: { isNot: { id: { in: [...followingIds, userId] } } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
  likedPosts: async (parent: any, { id }: LikedPostsArgs, context: Context) => {
    return context.prisma.like.findMany({
      where: {
        user: { id },
      },
      orderBy: {
        // TODO: This should be ordered by WHEN liked not when liked post was created
        createdAt: 'desc',
      },
    });
  },
};

export default Query;
