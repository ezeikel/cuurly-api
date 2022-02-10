import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import cloudinary from 'cloudinary';
import { Context } from '../context';
import { transport, makeNiceEmail } from '../mail';
import { isLoggedIn, processFile } from '../utils';

type SignupArgs = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
};

const Mutations = {
  signup: async (
    parent,
    { firstName, lastName, email, username, password }: SignupArgs,
    { prisma, res }: Context,
  ) => {
    // TODO: Loop over args and lowercase
    email = email.toLowerCase();
    username = username.toLowerCase();

    // TODO: Do some kind of check for taken username aswell
    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists) {
      throw new Error(
        'email: Hmm, a user with that email already exists. Use another one or sign in.',
      );
    }
    // hash password
    password = await bcrypt.hash(password, 10);
    // create user in the db
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        username,
        password,
      },
    });
    // create JWT token for user
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // we set the jwt as a cookie on the response
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });
    // finally return user the the browser
    return user;
  },
  signin: async (parent, { username, password }, { prisma, res }: Context) => {
    // check if a user with username exists
    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });
    if (!user) {
      throw new Error(
        "username: Hmm, we couldn't find that username in our records. Try again.",
      );
    }
    // check if the password is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error(
        "password: Hmm, that password doesn't match the one we have on record. Try again.",
      );
    }
    // generate the jwt
    const token = jwt.sign(
      { userId: user.id },
      process.env.APP_SECRET as string,
    );
    // set cookie with the token
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    return user;
  },
  signout: (parent: any, args: {}, { res }: Context) => {
    res.clearCookie('token');
    return { message: 'Goodbye!' };
  },
  requestReset: async (parent, { email }, { prisma }: Context) => {
    // check if this user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(
        "email: Hmm, we couldn't find that email in our records. Try again.",
      );
    }
    // set a reset token and expiry for that user
    const randomBytesPromisified = promisify(randomBytes);
    const resetToken = (await randomBytesPromisified(20)).toString('hex');
    const resetTokenExpiry = (Date.now() + 36000000).toString(); // 1 hour from now
    await prisma.user.update({
      where: {
        email,
      },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });
    // email the user the reset token
    const res = await transport.sendMail({
      from: 'crowndapp@gmail.com',
      to: user.email,
      subject: 'Reset Your Password',
      html: makeNiceEmail(`
        Hi ${user.username},
        \n\n
        We got a request to reset your Crownd password.
        <button style="color:#3b5998;text-decoration:none;display:block;width:370px">
          <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Reset Password</a>
        </button>
        \n\n
        If you ignore this message, your password will not be changed. If you didn't request a password reset, <a href="#">let us know</a>.
      `),
    });
    // return message
    return { message: `Message sent: ${res.messageId}` };
  },
  resetPassword: async (
    _,
    { resetToken, password, confirmPassword },
    { prisma, res }: Context,
  ) => {
    // check if that passwords match
    if (password !== confirmPassword) {
      throw new Error("Passwords don't  match");
    }
    // check if its a legit reset token
    // check if its expired
    const [user] = await prisma.user.findMany({
      where: {
        AND: [
          { resetToken },
          { resetTokenExpiry: { gt: (Date.now() - 3600000).toString() } },
        ],
      },
    });
    if (!user) {
      throw new Error('This is token is either invalid or expired!');
    }
    // hash new password
    const newPassword = await bcrypt.hash(password, 10);
    // save a new password to the user and set resetToken fields back to null
    const updatedUser = await prisma.user.update({
      where: {
        email: user.email,
      },
      data: {
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
    // generate jwt
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // we set the jwt as a cookie on the response
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });
    // TODO: Check if we are returning everything on user here
    return updatedUser;
  },
  follow: async (parent, { id }, { prisma, user: { id: userId } }: Context) => {
    isLoggedIn(userId);
    const followers = await prisma.user
      .findUnique({ where: { id } })
      .followers();
    const followerIds = followers.map(follower => follower.id);
    if (followerIds.includes(userId)) {
      throw new Error(`You are already following ${id}`);
    }
    await prisma.user.update({
      where: {
        id,
      },
      data: {
        followers: {
          connect: { id: userId },
        },
      },
    });
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        following: {
          connect: { id },
        },
      },
    });
  },
  unfollow: async (
    parent,
    { id },
    { prisma, user: { id: userId } }: Context,
  ) => {
    isLoggedIn(userId);
    const followers = await prisma.user
      .findUnique({ where: { id } })
      .followers();
    const followerIds = followers.map(follower => follower.id);
    if (!followerIds.includes(userId)) {
      throw new Error(`You are not following ${id}`);
    }
    await prisma.user.update({
      where: {
        id,
      },
      data: {
        followers: {
          disconnect: { id: userId },
        },
      },
    });
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        following: {
          disconnect: { id },
        },
      },
    });
  },
  createPost: async (
    parent,
    { file, caption },
    { prisma, user: { id: userId } }: Context,
  ) => {
    isLoggedIn(userId);
    const tags = ['user_post'];
    const { url, publicId, fileType } = await processFile({
      file,
      tags,
      userId,
    });
    return prisma.post.create({
      data: {
        author: {
          connect: {
            id: userId,
          },
        },
        media: {
          // TODO: should be an array of media
          create: {
            type: fileType.toUpperCase(),
            url,
            publicId,
          },
        },
        caption,
      },
    });
  },
  deletePost: async (
    parent,
    { id, publicId },
    { prisma, user: { id: userId } }: Context,
  ) => {
    isLoggedIn(userId);
    // deleting each related document due to https://github.com/prisma/prisma/issues/3796
    await prisma.comment.deleteMany({
      where: {
        post: {
          id,
        },
      },
    });

    await prisma.like.deleteMany({
      where: {
        post: {
          id,
        },
      },
    });

    // TODO: promisify this
    // BUG: deleting video doesnt seem to work properly. Deleted from db but not from cloudinary
    cloudinary.v2.api.delete_resources([publicId], (error, result) => {
      if (error) {
        console.error({ error });
      }
    });

    return prisma.post.delete({ where: { id } });
  },
  likePost: (parent, { id }, { prisma, user: { id: userId } }: Context) => {
    isLoggedIn(userId);
    // TODO: Add check to make sure a User cannot like a post more than once
    return prisma.like.create({
      data: {
        user: {
          connect: {
            id: userId,
          },
        },
        post: {
          connect: {
            id,
          },
        },
      },
    });
  },
  unlikePost: (parent, { id }, { prisma, user: { id: userId } }: Context) => {
    isLoggedIn(userId);
    return prisma.like.delete({ where: { id } });
  },
  addComment: (
    parent,
    { id, text },
    { prisma, user: { id: userId } }: Context,
  ) => {
    isLoggedIn(userId);
    return prisma.comment.create({
      data: {
        post: {
          connect: {
            id,
          },
        },
        text,
        writtenBy: {
          connect: {
            id: userId,
          },
        },
      },
    });
  },
  deleteComment: (
    parent,
    { id },
    { prisma, user: { id: userId } }: Context,
  ) => {
    isLoggedIn(userId);
    return prisma.comment.delete({ where: { id } });
  },
  updateUser: async (
    _,
    {
      firstName,
      lastName,
      username,
      profilePicture,
      website,
      bio,
      email,
      phoneNumber,
      gender,
      oldPassword,
      password,
    },
    { prisma, user: { id: userId } }: Context,
  ) => {
    isLoggedIn(userId);
    if (profilePicture) {
      // TODO: delete existing profile picture from cloudinary if there is one

      const tags = ['user_profile_picture'];
      const folder = `users/${userId}/uploads/images`;
      const { createReadStream } = await profilePicture;
      const { url, publicId } = await processFile({
        file: { createReadStream, fileType: 'image' },
        tags,
        userId,
      });
      profilePicture = {
        url,
        publicId,
      };
    }

    if (password) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      const valid = await bcrypt.compare(oldPassword, user.password);
      if (!valid) {
        throw new Error('Invalid password!');
      }
      password = await bcrypt.hash(password, 10);
    }

    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        firstName,
        lastName,
        username,
        email,
        phoneNumber,
        gender,
        password,
        profile: {
          update: {
            bio,
            website,
            picture: {
              upsert: {
                create: profilePicture
                  ? {
                      url: profilePicture.url,
                      publicId: profilePicture.publicId,
                    }
                  : undefined,
                update: profilePicture
                  ? {
                      url: profilePicture.url,
                      publicId: profilePicture.publicId,
                    }
                  : undefined,
              },
            },
          },
        },
      },
    });
  },
};

export default Mutations;
