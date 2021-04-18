const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, makeNiceEmail } = require("../mail");
const cloudinary = require("cloudinary");
const { isLoggedIn } = require("../utils");

// TODO: remove hardcoded values and read from .env instead
cloudinary.config({
  cloud_name: "crownd",
  api_key: "587685821236624",
  api_secret: "xHtsSFHgmkRH1-4jT4Mjt1uosfg",
});

const processUpload = async ({ file, folder, tags }) => {
  const { createReadStream, fileType } = file;

  const stream = createReadStream();

  let resultUrl = "",
    resultSecureUrl = "",
    publicId = "";

  const cloudinaryUpload = async ({ stream }) => {
    // TODO: proper conditioning needed here
    const uploadConfig =
      fileType === "image"
        ? {
            folder,
            tags,
            overwrite: true,
            transformation: {
              width: 1080,
              crop: "limit",
              //aspect_ratio: '4:5',
              format: "jpg",
            },
          }
        : {
            resource_type: "video",
            folder,
            tags,
            overwrite: true,
          };

    try {
      await new Promise((resolve, reject) => {
        const streamLoad = cloudinary.v2.uploader.upload_stream(
          uploadConfig,
          function(error, result) {
            if (result) {
              console.log({ result });
              resultUrl = result.url;
              resultSecureUrl = result.secure_url;
              publicId = result.public_id;
              resolve({ resultSecureUrl, publicId });
            } else {
              reject(error);
            }
          }
        );

        stream.pipe(streamLoad);
      });
    } catch (err) {
      throw new Error(`Failed to upload file! Err:${err.message}`);
    }
  };

  await cloudinaryUpload({ stream });
  return { resultUrl, resultSecureUrl, publicId };
};

const Mutations = {
  signup: async (_, args, ctx, info) => {
    // TODO: Loop over args and lowercase
    args.email = args.email.toLowerCase();
    args.username = args.username.toLowerCase();

    // TODO: Do some kind of check for taken username aswell
    const exists = await ctx.prisma.user({ email: args.email });
    if (exists) {
      throw new Error(
        "email: Hmm, a user with that email already exists. Use another one or sign in."
      );
    }

    // hash password
    const password = await bcrypt.hash(args.password, 10);

    // create user in the db
    const user = await ctx.prisma.createUser(
      {
        ...args,
        password,
      },
      info
    );
    // create JWT token for user
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    // we set the jwt as a cookie on the response
    ctx.res.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });
    // finally return user the the browser
    return user;
  },
  signin: async (_, { username, password }, ctx, info) => {
    // 1. check if there is a user with that email
    const user = await ctx.prisma.user({ username }, info);

    if (!user) {
      throw new Error(
        "username: Hmm, we couldn't find that username in our records. Try again."
      );
    }
    // 2. check if their password is correct
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      throw new Error(
        "password: Hmm, that password doesn't match the one we have on record. Try again."
      );
    }
    // 3. generate the jwt token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // 4. set the cookie with the token
    ctx.res.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    // 5. return the user
    return user;
  },
  signout: (_, args, ctx, info) => {
    ctx.res.clearCookie("token");
    return { message: "Goodbye!" };
  },
  requestReset: async (_, { email }, ctx, info) => {
    // check if this user exists
    const user = await ctx.prisma.user({ email }, info);

    if (!user) {
      throw new Error(
        "email: Hmm, we couldn't find that email in our records. Try again."
      );
    }

    // set a reset token and expiry for that user
    const randomBytesPromisified = promisify(randomBytes);
    const resetToken = (await randomBytesPromisified(20)).toString("hex");
    const resetTokenExpiry = (Date.now() + 36000000).toString(); // 1 hour from now

    await ctx.prisma.updateUser({
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
      from: "crowndapp@gmail.com",
      to: user.email,
      subject: "Reset Your Password",
      html: makeNiceEmail(`
        Hi ${user.username},
        \n\n
        We got a request to reset your Crownd password.
        <button style="color:#3b5998;text-decoration:none;display:block;width:370px">
          <a href="${
            process.env.FRONTEND_URL
          }/reset?resetToken=${resetToken}">Reset Password</a>
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
    ctx,
    info
  ) => {
    // check if that passwords match
    if (password !== confirmPassword) {
      throw new Error("Passwords don't  match");
    }

    // check if its a legit reset token
    // check if its expired
    const [user] = await ctx.prisma.users({
      where: {
        AND: [
          { resetToken },
          { resetTokenExpiry_gt: (Date.now() - 3600000).toString() },
        ],
      },
    });

    if (!user) {
      throw new Error("This is token is either invalid or expired!");
    }

    // hash new password
    const newPassword = await bcrypt.hash(password, 10);

    // save a new password to the user and set resetToken fields back to null
    const updatedUser = await ctx.prisma.updateUser({
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
    ctx.res.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });

    // TODO: Check if we are returning everything on user here
    return updatedUser;
  },
  follow: async (_, { id }, ctx, info) => {
    isLoggedIn(ctx);

    const followers = await ctx.prisma.user({ id }, info).followers();
    const followerIds = followers.map((follower) => follower.id);

    if (followerIds.includes(ctx.user.id)) {
      throw new Error(`You are already following ${id}`);
    }

    await ctx.prisma.updateUser({
      where: {
        id,
      },
      data: {
        followers: {
          connect: { id: ctx.user.id },
        },
      },
    });

    return ctx.prisma.updateUser({
      where: {
        id: ctx.user.id,
      },
      data: {
        following: {
          connect: { id },
        },
      },
    });
  },
  unfollow: async (_, { id }, ctx, info) => {
    isLoggedIn(ctx);

    const followers = await ctx.prisma.user({ id }, info).followers();
    const followerIds = followers.map((follower) => follower.id);

    if (!followerIds.includes(ctx.user.id)) {
      throw new Error(`You are not following ${id}`);
    }

    await ctx.prisma.updateUser({
      where: {
        id,
      },
      data: {
        followers: {
          disconnect: { id: ctx.user.id },
        },
      },
    });

    return ctx.prisma.updateUser({
      where: {
        id: ctx.user.id,
      },
      data: {
        following: {
          disconnect: { id },
        },
      },
    });
  },
  createPost: async (_, { file, caption }, ctx, info) => {
    isLoggedIn(ctx);
    let fileType;

    const { createReadStream, mimetype } = await file;

    console.log({ mimetype });

    switch (mimetype) {
      case "image/png":
      case "image/jpg":
      case "image/jpeg":
      case "image/heic":
        fileType = "image";
        break;
      case "video/mp4":
      case "video/quicktime":
        fileType = "video";
        break;
    }

    const tags = ["user_post"];
    const folder = `users/${ctx.user.id}/uploads/${fileType}s`;
    const { resultSecureUrl, publicId } = await processUpload({
      file: { createReadStream, fileType },
      tags,
      folder,
    });

    return ctx.prisma.createPost(
      {
        author: {
          connect: {
            id: ctx.user.id,
          },
        },
        content: {
          create: {
            type: fileType.toUpperCase(),
            url: resultSecureUrl,
            publicId,
          },
        },
        caption,
      },
      info
    );
  },
  deletePost: async (_, { id, publicId }, ctx, info) => {
    isLoggedIn(ctx);

    // deleting each related document due to https://github.com/prisma/prisma/issues/3796
    await ctx.prisma.deleteManyComments({
      post: {
        id,
      },
    });

    await ctx.prisma.deleteManyLikes({
      post: {
        id,
      },
    });

    // TODO: promisify this
    // BUG: deleting video doesnt seem to work properly. Deleted from db but not from cloudinary
    cloudinary.v2.api.delete_resources([publicId], (error, result) => {
      if (error) console.log({ error });
    });

    return ctx.prisma.deletePost({ id }, info);
  },
  likePost: (_, { id }, ctx, info) => {
    isLoggedIn(ctx);

    // TODO: Add check to make sure a User cannot like a post more than once

    return ctx.prisma.createLike(
      {
        user: {
          connect: {
            id: ctx.user.id,
          },
        },
        post: {
          connect: {
            id,
          },
        },
      },
      info
    );
  },
  unlikePost: (_, { id }, ctx, info) => {
    isLoggedIn(ctx);

    return ctx.prisma.deleteLike({ id }, info);
  },
  addComment: (_, { id, text }, ctx, info) => {
    isLoggedIn(ctx);

    return ctx.prisma.createComment({
      post: {
        connect: {
          id,
        },
      },
      text,
      writtenBy: {
        connect: {
          id: ctx.user.id,
        },
      },
    });
  },
  deleteComment: (_, { id }, ctx, info) => {
    isLoggedIn(ctx);

    return ctx.prisma.deleteComment({ id });
  },
  updateUser: async (
    _,
    {
      name,
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
    ctx,
    info
  ) => {
    isLoggedIn(ctx);

    if (profilePicture) {
      const tags = ["user_profile_picture"];
      const folder = `users/${ctx.user.id}/uploads/images`;

      const { createReadStream } = await profilePicture;

      const { resultSecureUrl, publicId } = await processUpload({
        file: { createReadStream, fileType: "image" },
        tags,
        folder,
      });

      profilePicture = {
        url: resultSecureUrl,
        publicId,
      };
    }

    if (password) {
      const user = await ctx.prisma.user({ id: ctx.user.id });
      const valid = await bcrypt.compare(oldPassword, user.password);

      if (!valid) {
        throw new Error("Invalid password!");
      }

      password = await bcrypt.hash(password, 10);
    }

    return ctx.prisma.updateUser(
      {
        where: {
          id: ctx.user.id,
        },
        data: {
          name,
          username,
          profilePicture: {
            create: profilePicture,
          },
          website,
          bio,
          email,
          phoneNumber,
          gender,
          password,
        },
      },
      info
    );
  },
};

module.exports = Mutations;
