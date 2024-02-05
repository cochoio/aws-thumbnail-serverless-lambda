"use client";

const {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const querystring = require("querystring");
const sharp = require("sharp");

const region = "";
const bucket = "";

exports.handler = async (event, context, callback) => {
  let { request, response } = event.Records[0].cf.response;

  const params = querystring.parse(request.querystring);
  const bucket = params.bucket || DEFAULT_BUCKET;

  const { uri } = request;
  const [, imageName, extension] = uri.match(/\/?(.*)\.(.*)/);

  const client = new S3Client({
    region,
  });

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: decodeURI(imageName + "." + extension),
  });

  const s3Object = await client.send(command);

  const contentType = s3Object.ContentType;

  if (!contentType || !contentType.startsWith("image")) {
    return callback(null, response);
  }

  let width;
  let height;
  let format;
  let quality;
  let resizedImage;

  width = parseInt(params.w, 10) ? parseInt(params.w, 10) : null;
  height = parseInt(params.h, 10) ? parseInt(params.h, 10) : null;
  if (parseInt(params.q, 10)) {
    quality = parseInt(params.q, 10);
  }
  format = params.f ? params.f : extension;
  format = format === "jpg" ? "jpeg" : format;

  if (!params.w && !params.h) {
    return callback(null, response);
  }

  try {
    resizedImage = await sharp(s3Object.Body)
      .resize(width, height)
      .toFormat(format, { quality })
      .toBuffer();
  } catch (e) {
    return callback(error);
  }

  const resizedImageByteLength = Buffer.byteLength(resizedImage, "base64");

  if (resizedImageByteLength >= 1 * 1024 * 1024) {
    return callback(null, response);
  }

  response.status = 200;
  response.body = resizedImage.toString("base64");
  response.bodyEncoding = "base64";
  response.headers["content-type"] = [
    {
      key: "Content-Type",
      value: `image/${format}`,
    },
  ];
  return callback(null, response);
};
