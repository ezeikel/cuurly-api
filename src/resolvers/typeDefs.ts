import { gql } from 'apollo-server-lambda';

const typeDefs = gql`
  scalar Date
  scalar Upload

  enum Gender {
    MALE
    FEMALE
    NONBINARY
    NOTSPECIFIED
  }

  enum Role {
    USER
    ADMIN
  }

  type SuccessMessage {
    message: String
  }

  type Like {
    id: ID!
    user: User!
    post: Post!
    createdAt: Date!
    updatedAt: Date!
  }

  type Comment {
    id: ID!
    text: String!
    writtenBy: User!
    post: Post!
    createdAt: Date!
    updatedAt: Date!
  }

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    username: String!
    profilePicture: Media
    website: String
    bio: String
    email: String!
    phoneNumber: String
    gender: Gender!
    following: [User!]!
    followers: [User!]!
    verified: Boolean!
    gravatar: String
    posts: [Post!]!
    likes: [Like!]!
    comments: [Comment!]!
    role: Role!
    createdAt: Date!
    updatedAt: Date!
  }

  type Post {
    id: ID!
    caption: String
    media: [Media!]!
    author: User!
    likes: [Like!]!
    comments: [Comment!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Media {
    id: ID!
    type: String!
    caption: String
    url: String!
    publicId: String!
    createdAt: Date!
    updatedAt: Date!
  }

  type Query {
    currentUser: User
    # users(
    #   where: UserWhereInput
    #   orderBy: UserOrderByInput
    #   skip: Int
    #   first: Int
    # ): [User!]!
    users(query: String): [User!]!
    userz: [User!]! # Just for testing
    user(id: ID, username: String, email: String): User # TODO: Find a way to make it that you have to pass one of these
    following(id: ID, username: String, email: String): [User!]!
    followers(id: ID, username: String, email: String): [User!]!
    profilePicture: Media
    posts: [Post!]!
    post(id: ID!): Post
    feed(id: ID!): [Post!]!
    explore(id: ID!): [Post!]!
    likedPosts(id: ID!): [Post!]!
  }

  type Mutation {
    signup(
      firstName: String!
      lastName: String!
      username: String!
      email: String!
      password: String!
    ): User!
    signin(username: String!, password: String!): User!
    signout: SuccessMessage
    requestReset(email: String!): SuccessMessage
    resetPassword(
      resetToken: String!
      password: String!
      confirmPassword: String!
    ): User!
    follow(id: ID!): User!
    unfollow(id: ID!): User!
    createPost(file: Upload!, caption: String): Post!
    # singleUpload (file: Upload!): File!
    # multipleUpload (files: [Upload!]!): [File!]!
    deletePost(id: ID!, publicId: String!): Post!
    likePost(id: ID!): Like!
    unlikePost(id: ID!): Like!
    addComment(id: ID!, text: String!): Comment!
    deleteComment(id: ID!): Comment!
    updateUser(
      firstName: String
      lastName: String
      username: String
      profilePicture: Upload
      website: String
      bio: String
      email: String
      phoneNumber: String
      gender: String
      oldPassword: String
      password: String
    ): User!
  }
`;

export default typeDefs;
