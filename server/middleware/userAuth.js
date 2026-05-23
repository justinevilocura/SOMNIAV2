import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
        path: '/'
      });
      return res.status(401).json({ 
        success: false, 
        message: "Not Authorized. Please login again." 
      });
    }

    try {
      const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

      if (!tokenDecode || !tokenDecode.id) {
        res.clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
          path: '/'
        });
        return res.status(401).json({ 
          success: false, 
          message: "Invalid token. Please login again." 
        });
      }

      req.body = req.body || {};
      req.body.userId = tokenDecode.id;
      next();
    } catch (error) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
        path: '/'
      });
      return res.status(401).json({ 
        success: false, 
        message: "Token verification failed. Please login again." 
      });
    }
  } catch (error) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
      path: '/'
    });
    return res.status(500).json({ 
      success: false, 
      message: "Server error during authentication" 
    });
  }
};

export default userAuth;
