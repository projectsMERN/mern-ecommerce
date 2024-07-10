require('dotenv').config();
const express = require('express');
const server = express();
const mongoose = require('mongoose');
const cors = require('cors'); 
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const crypto = require('crypto');
const passport = require('passport');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const LocalStrategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const path = require('path')

const { createProduct } = require('./controller/Product');
const productsRouter = require('./routes/Products');
const categoriesRouter = require('./routes/Categories');
const brandsRouter = require('./routes/Brands');
const usersRouter = require('./routes/Users');
const authRouter = require('./routes/Auth');
const cartRouter = require('./routes/Cart');
const ordersRouter = require('./routes/Order')
const { User } = require('./model/User')
const { isAuth, sanitizeUser, cookieExtractor } = require('./services/common');
const { env } = require('process');

const {
  generateAccessToken,
  fetchEmployeeRecords,
  getEmailByOfficialName,
  currentLoggedInUserDetails
} = require('./controller/Auth');

// Stripe webhook
// const endpointSecret = process.env.ENDPOINT_SECRET
// server.post(
//   '/webhook',
//   express.raw({ type: 'application/json' }),
//   async (request, response) => {
//     const sig = request.headers['stripe-signature'];

//     let event;

//     try {
//       event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
//     } catch (err) {
//       response.status(400).send(`Webhook Error: ${err.message}`);
//       return;
//     }

//     // Handle the event
//     switch (event.type) {
//       case 'payment_intent.succeeded':
//         const paymentIntentSucceeded = event.data.object;

//         const order = await Order.findById(
//           paymentIntentSucceeded.metadata.orderId
//         );
//         order.paymentStatus = 'received';
//         await order.save();

//         break;
//       // ... handle other event types
//       default:
//         console.log(`Unhandled event type ${event.type}`);
//     }

//     // Return a 200 response to acknowledge receipt of the event
//     response.send();
//   }
// );

// const token = jwt.sign({ foo: 'bar' }, process.env.JWT_SECRET_KEY);

const opts = {}
opts.jwtFromRequest = cookieExtractor
opts.secretOrKey = process.env.JWT_SECRET_KEY;

//middlewares
server.use(express.static(path.resolve(__dirname, 'build')));
server.use(cookieParser());
server.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
  })
);
server.use(passport.authenticate('session'));
server.use(
  cors({
    exposedHeaders: ['X-Total-Count']
  })
);  
server.use(express.json()); // to parse req.body
server.use('/products', isAuth(), productsRouter.router)
server.use('/categories', isAuth(), categoriesRouter.router)
server.use('/brands', isAuth(), brandsRouter.router)
server.use('/users', isAuth(), usersRouter.router)
server.use('/auth', authRouter.router)
server.use('/cart', isAuth(), cartRouter.router)
server.use('/orders', isAuth(), ordersRouter.router)

// Passport Strategies
// passport.use(
//   'local',
//   new LocalStrategy({ usernameField: 'email' }, async function (
//     email,
//     password,
//     done
//   ) {
//     try {
//       // Check if the user exists in the database
//       const password = "tataPlayUser$@!qwr"
//       let user = await User.findOne({ email: email });
//       if (user === null) {
//         // Create a new user if not exists
//         const salt = crypto.randomBytes(16);
//         crypto.pbkdf2(
//           password,
//           salt,
//           310000,
//           32,
//           'sha256',
//           async function (err, hashedPassword) {
//             if (err) {
//               return done(err);
//             }
//             user = new User({ email, password: hashedPassword, salt, verified:true});
//             await user.save();
//             const token = jwt.sign(sanitizeUser(user), process.env.JWT_SECRET_KEY);
//             return done(null, { id: user.id, role: user.role, token });
//           }
//         );
//       } else {
//         // Validate the password
//         crypto.pbkdf2(
//           password,
//           user.salt,
//           310000,
//           32,
//           'sha256',
//           async function (err, hashedPassword) {
//             if (err) {
//               return done(err);
//             }
//             if (!crypto.timingSafeEqual(user.password, hashedPassword)) {
//               return done(null, false, { message: 'Invalid credentials' });
//             }
//             const token = jwt.sign(sanitizeUser(user), process.env.JWT_SECRET_KEY);
//             done(null, { id: user.id, role: user.role, token });
//           }
//         );
//       }
//     } catch (err) {
//       done(err);
//     }
//   })
// );
passport.use(
  'local',
  new LocalStrategy({ usernameField: 'email' }, async function (
    email,
    password,
    done
  ) {
    try {
      // Generate access token
      console.log("employee chech in started")
      const accessToken = await generateAccessToken();
      // Fetch employee records from Zoho
      const employeeRecords = await fetchEmployeeRecords(accessToken);
      // Get email from Zoho records
      const emailFromZoho = getEmailByOfficialName(employeeRecords, email);
      console.log("employee chech in done")
      if (!emailFromZoho) {
        console.log("Email not found")
        return done(null, false, { message: 'Email not found in Zoho records' });
      }

      // Check if the user exists in the database
      let user = await User.findOne({ email: emailFromZoho });
      const tempPass = "tataPlayUser$@!qwr";

      if (user === null) {
        // Create a new user if not exists
        const salt = crypto.randomBytes(16);
        crypto.pbkdf2(
          tempPass,
          salt,
          310000,
          32,
          'sha256',
          async function (err, hashedPassword) {
            if (err) {
              return done(err);
            }
            user = new User({ email: emailFromZoho, password: hashedPassword, salt, verified: true });
            await user.save();
            const token = jwt.sign(sanitizeUser(user), process.env.JWT_SECRET_KEY);
            return done(null, { id: user.id, role: user.role, token });
          }
        );
      } else {
        // Validate the password
        crypto.pbkdf2(
          password,
          user.salt,
          310000,
          32,
          'sha256',
          async function (err, hashedPassword) {
            if (err) {
              return done(err);
            }
            // if (!crypto.timingSafeEqual(user.password, hashedPassword)) {
            //   return done(null, false, { message: 'Invalid credentials' });
            // }
            const token = jwt.sign(sanitizeUser(user), process.env.JWT_SECRET_KEY);
            done(null, { id: user.id, role: user.role, token });
          }
        );
      }
    } catch (err) {
      done(err);
    }
  })
);


passport.use(
  'jwt',
  new JwtStrategy(opts, async function (jwt_payload, done) {
    try {
      const user = await User.findById(jwt_payload.id);
      if (user) {
        return done(null, sanitizeUser(user)); // this calls serializer
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err, false);
    }
  })
);

// this creates session variable req.user on being called from callbacks
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, { id: user.id, role: user.role });
  });
});

// this changes session variable req.user when called from authorized request

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

// Stripe Payments
// This is your test secret API key.
// const stripe = require('stripe')(process.env.STRIPE_SERVER_KEY);

// server.post('/create-payment-intent', async (req, res) => {
//   const { totalAmount, orderId } = req.body;

// Create a PaymentIntent with the order amount and currency
//   const paymentIntent = await stripe.paymentIntents.create({
//     amount: totalAmount * 100, // for decimal compensation
//     currency: 'inr',
//     automatic_payment_methods: {
//       enabled: true,
//     },
//     metadata: {
//       orderId,
//     },
//   });

//   res.send({
//     clientSecret: paymentIntent.client_secret,
//   });
// });

main().catch((err) => console.log(err));

async function main() {
await mongoose.connect(process.env.MONGODB_URL);
console.log('database connected');
}

server.listen(process.env.PORT, () => {
console.log('server started');
});