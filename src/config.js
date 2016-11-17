export default {
  mailgun:
  {
    auth: {
      api_key: process.env.MAILGUN_PUBLIC_KEY || '',
      domain: process.env.MAILGUN_DOMAIN || ''
    }
  }
};
