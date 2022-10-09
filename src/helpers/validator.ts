import * as EmailValidator from "email-validator";

const twitterRegexp = /^@[a-zA-Z0-9_]{1,15}$/;

export const validateEmail = (email: string) => {
  // return true;
  return !email || EmailValidator.validate(email);
};

export const validateTwitterHandle = (twitterHandle: string) => {
  // return true;
  return (
    !twitterHandle ||
    (twitterHandle.toLowerCase().indexOf("twitter") === -1 &&
      twitterHandle.toLowerCase().indexOf("admin") === -1 &&
      twitterRegexp.test(twitterHandle))
  );
};

export const validateAttributeLength = (
  attribute: string,
  maxLength: number
) => {
  return !attribute || attribute.length < maxLength;
};
