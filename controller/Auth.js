const { User } = require('../model/User');
const crypto = require('crypto');
const { sanitizeUser, sendMail } = require('../services/common');
const jwt = require('jsonwebtoken');
const axios = require('axios');

var springedge = require('springedge');

exports.createUser = async (email, tempPass) => {
  try {
    const salt = crypto.randomBytes(16);
    crypto.pbkdf2(
      tempPass,
      salt,
      310000,
      32,
      'sha256',
      async function (err, hashedPassword) {
        const user = new User({ email, password: hashedPassword, salt });
        // Send a confirmation mail to user
        // const userEmail = req.body.email; 
        // const logoutLink = "http://localhost:3000/logout";
        // const subject = 'Tata Play Ecom Verification';
        // const html = `<p>Click <a href='${logoutLink}'>here</a> to complete verification. After clicking the link you will be redirected to the login page.</p>`;
        // console.log("email id of user is: ");
        // console.log(req.body.email);
        // const response = await sendMail({ to: req.body.email, subject, html });

        const doc = await user.save();

        console.log("doc is: ")
        console.log(doc);

        req.login(doc, (err) => {
          // this also calls serializer and adds to session
          if (err) {
            res.status(400).json(err);
          } else {
            const token = jwt.sign(
              sanitizeUser(doc),
              process.env.JWT_SECRET_KEY
            );
            res
              .cookie('jwt', token, {
                expires: new Date(Date.now() + 3600000),
                httpOnly: true,
              })
              .status(201)
              .json({ id: doc.id, role: doc.role });
          }
        });
      }
    );
  } catch (err) {
    res.status(400).json(err);
  }
};

// Function to generate access token using refresh token
async function generateAccessToken() {
  const tokenResponse = await axios.post('https://accounts.zoho.in/oauth/v2/token?', null, {
    params: {
      grant_type: 'refresh_token',
      client_id: '1000.623LGEAT6EH7D7MKYFT20I6FRHCFIJ',
      client_secret: '1e6e59073d1c11fbc8ae7c757626932f02f6b2e41c',
      redirect_uri: 'https://www.employeeform.in/callback',
      refresh_token: '1000.bc9ce8fad3c4799e7ef89ff6200527a1.8311e0aed6efd7bc90c057b89c5b9cdf'
    },
    headers: {
      'Cookie': 'JSESSIONID=74ACBC7D19F9F610DC1BA4271951A273; _zcsr_tmp=7ace336c-aad9-474c-814c-7b1d026f5eb6; iamcsr=7ace336c-aad9-474c-814c-7b1d026f5eb6; zalb_6e73717622=4440853cd702ab2a51402c119608ee85'
    }
  });

  return tokenResponse.data.access_token;
}

// Function to fetch employee records from Zoho
async function fetchEmployeeRecords(accessToken) {
  const recordsResponse = await axios.get('https://people.zoho.in/people/api/forms/employee/getRecords', {
    params: {
      sIndex: 0,
      limit: 200
    },
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`
    }
  });
  return recordsResponse.data.response.result;
}

// Function to get email by official name from Zoho records
function getEmailByOfficialName(employeeRecords, userEmail) {
  for (const emp of employeeRecords) {
    const empDetails = Object.values(emp)[0][0];
    if (empDetails.EmailID === userEmail) {
      return empDetails.EmailID;
    }
  }
  return null;
}

exports.loginUser = async (req, res) => {
  const user = req.user;
  // console.log(req.body);
  // console.log("created at: ");

  const userEmail = req.body.email;
  console.log("Inside loginUser method")
  // ---Zoho connection
  const accessToken = await generateAccessToken();
    const employeeRecords = await fetchEmployeeRecords(accessToken);

    const emailFromZoho = getEmailByOfficialName(employeeRecords, userEmail);
    if (!emailFromZoho) {
      console.log("Unauthorized: Email not found in Zoho records")
      // return
      // return res.status(401).send('Unauthorized: Email not found in Zoho records');
    } else {
      const userDetails = exports.currentLoggedInUserDetails(employeeRecords, emailFromZoho);
      console.log(userDetails)

      const searchEmailInDB = await User.findOne({ email: emailFromZoho });
      console.log(searchEmailInDB)

      if(searchEmailInDB) {
        console.log("Found email in mongodb")
        
        // Update the user's address if the addresses array is null or empty
        if (!searchEmailInDB.addresses || searchEmailInDB.addresses.length === 0) {
          searchEmailInDB.addresses = [{
            name: userDetails.Official_Name,
            email: userDetails.EmailID,
            phone: userDetails.Mobile,
            street: userDetails.Current_Address1,
            city: userDetails.Work_location,
            state: userDetails.Work_location,
            pinCode: userDetails.Current_Pincode
          }];
          await searchEmailInDB.save();  // Save the user with updated addresses
        }

        const generatedOtp = params.message
        if(req.body.password === generatedOtp) {
          res
          .cookie('jwt', user.token, {
            expires: new Date(Date.now() + 3600000),
            httpOnly: true,
          })
          .status(201)
          .json({ id: user.id, role: user.role, verified: true });
        } else {
          res.sendStatus(401);
        }
        return
      } 
      console.log("no user found")
      
      // const userAddressUpdate = await User.findByIdAndUpdate(userDetails.EmailID);
      
      
      // userAddressUpdate.addresses.name = userDetails.Official_Name;
      
      // userAddressUpdate.addresses.email = userDetails.emailFromZoho;
      // userAddressUpdate.addresses.phone = userDetails.Mobile;
      // userAddressUpdate.addresses.street = userDetails.Current_Address1;
      // userAddressUpdate.addresses.city = userDetails.Work_location;
      // userAddressUpdate.addresses.state = userDetails.Work_location;
      // userAddressUpdate.addresses.pinCode = userDetails.Current_Pincode;

      // console.log(userDetails.Official_Name)
      // console.log(userAddressUpdate.addresses.name)
      // console.log(userAddressUpdate)
      // userAddressUpdate.addresses = userDetails.Current_Address1;
      // const primaryAddress = await userAddressUpdate.save();

      
      // console.log("logged in")
      // console.log(userDetails.Current_Address1)
      
      
    }


  // ---Zoho connection
  

  // const verifiedUser = await User.findByIdAndUpdate(user.id);
  // verifiedUser.verified = true;
  // const newVerificationUser = await verifiedUser.save();

  
};

exports.currentLoggedInUserDetails = (employeeRecords, emailFromZoho) => {
  for (const emp of employeeRecords) {
    const empDetails = Object.values(emp)[0][0];
    if (empDetails.EmailID === emailFromZoho) {
      return empDetails;
    }
  }
  return null;
}

exports.logout = async (req, res) => {
  res
    .cookie('jwt', null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .sendStatus(200)
};

exports.checkAuth = async (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.sendStatus(401);
  }
};

exports.resetPasswordRequest = async (req, res) => {
  const email = req.body.email;
  const user = await User.findOne({ email: email });
  if (user) {
    const token = crypto.randomBytes(48).toString('hex');
    user.resetPasswordToken = token;
    await user.save();

    // Also set token in email
    const resetPageLink =
      'http://localhost:3000/reset-password?token=' + token + '&email=' + email;
    const subject = 'reset password for e-commerce';
    const html = `<p>Click <a href='${resetPageLink}'>here</a> to Reset Password</p>`;

    // lets send email and a token in the mail body so we can verify that user has clicked right link

    if (email) {
      const response = await sendMail({ to: email, subject, html });
      res.json(response);
    } else {
      res.sendStatus(400);
    }
  } else {
    res.sendStatus(400)
  }
};

exports.resetPassword = async (req, res) => {
  const { email, password, token } = req.body;

  const user = await User.findOne({ email: email, resetPasswordToken: token });
  if (user) {
    const salt = crypto.randomBytes(16);
    crypto.pbkdf2(
      req.body.password,
      salt,
      310000,
      32,
      'sha256',
      async function (err, hashedPassword) {
        user.password = hashedPassword;
        user.salt = salt;
        await user.save();
        const subject = 'password successfully reset for e-commerce';
        const html = `<p>Successfully able to Reset Password</p>`;
        if (email) {
          const response = await sendMail({ to: email, subject, html });
          res.json(response);
        } else {
          res.sendStatus(400);
        }
      }
    );
  } else {
    res.sendStatus(400);
  }
};


var params = {
  'apikey': '621492a44a89m36c2209zs4l7e74672cj', // API Key
  'sender': 'SEDEMO', // Sender Name
  'to': [
    '918766659943'  //Moblie Number
  ],
  'message': 'Hello, This is a test message from spring edge',
  'format': 'json'
};

exports.otpVerification = async (req, res) => {
  const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * digits.length);
      otp += digits[randomIndex];
    }

  params.message = `${otp}`;
  const email = req.query.email;

  console.log(otp)
  // Send a confirmation mail to user
  const subject = 'Tata Play Ecom OTP verification';
  const html = `<p>You otp is: '${otp}'</p>`;

  //const response = await sendMail({ to: email, subject, html });
  const response = await sendMail({ to: 'rishilshinde17@gmail.com', subject, html });
  
  // springedge.messages.send(params, 5000, function (err, response) {
  //   if (err) {
  //     return console.log(err);
  //   }
  // });
}

exports.generateAccessToken = generateAccessToken;
exports.fetchEmployeeRecords = fetchEmployeeRecords;
exports.getEmailByOfficialName = getEmailByOfficialName;
