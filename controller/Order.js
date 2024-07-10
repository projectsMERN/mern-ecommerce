const { Order } = require("../model/Order");
const { Product } = require("../model/Product");
const { User } = require("../model/User");
const { sendMail, invoiceTemplate, adminInvoiceTemplate } = require("../services/common");
const excelJS = require('exceljs');

exports.fetchOrdersByUser = async (req, res) => {
    const { id } = req.user;
    try {
      const orders = await Order.find({ user: id }).sort({createdAt: -1});
  
      res.status(200).json(orders);
    } catch (err) {
      res.status(400).json(err);
    }
  };

  exports.createOrder = async (req, res) => {
    const order = new Order(req.body);
    // here we have to update stocks;
    
    for(let item of order.items){
       let product =  await Product.findOne({_id:item.product.id})
       product.$inc('stock',-1*item.quantity);
       // for optimum performance we should make inventory outside of product.
       await product.save()
    }

    try {
      const uniqueAppend = Math.random().toString().substring(2, 10);
      let obj = new Date(); 
      let year = obj.getUTCFullYear(); 
      let seconds = obj.getSeconds();
      const orderId = order.selectedAddress.city + "-" + year + "-" + uniqueAppend + seconds;

      // Assign custom orderId to _id
      order._id = orderId;

      const doc = await order.save();
      const user = await User.findById(order.user)
       // we can use await for this also 
       sendMail({to:user.email,html:invoiceTemplate(order),subject:'Order Received' })
       
      //Send mail to admin team
      sendMail({to:'rishilshindesocial@gmail.com',html:adminInvoiceTemplate(order, user.email),subject:'Order Received' })
      res.status(201).json(doc);
    } catch (err) {
      res.status(400).json(err);
    }
  };
  
  exports.deleteOrder = async (req, res) => {
      const { id } = req.params;
      try {
      const order = await Order.findByIdAndDelete(id);
      res.status(200).json(order);
    } catch (err) {
      res.status(400).json(err);
    }
  };
  
  exports.updateOrder = async (req, res) => {
    const { id } = req.params;
    try {
      const order = await Order.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      res.status(200).json(order);
    } catch (err) {
      res.status(400).json(err);
    }
  };

  exports.fetchAllOrders = async (req, res) => {
    // sort = {_sort:"price",_order="desc"}
    // pagination = {_page:1,_limit=10}
    let query = Order.find({deleted:{$ne:true}});
    let totalOrdersQuery = Order.find({deleted:{$ne:true}});
  
    
    if (req.query._sort && req.query._order) {
      query = query.sort({ [req.query._sort]: req.query._order });
    }
  
    const totalDocs = await totalOrdersQuery.count().exec();
    console.log({ totalDocs });
  
    if (req.query._page && req.query._limit) {
      const pageSize = req.query._limit;
      const page = req.query._page;
      query = query.skip(pageSize * (page - 1)).limit(pageSize).sort({createdAt: -1});
    }
  
    try {
      const docs = await query.exec();
      res.set('X-Total-Count', totalDocs);
      res.status(200).json(docs);
    } catch (err) {
      res.status(400).json(err);
    }
  };
  
  // New
  // One person can raise a single order
exports.checkProductExistance = async (req, res) => {
  const { userId, productId } = req.params;
  console.log("This is checkProdExistance");
  console.log(productId);

  try{
  // Got user job role
  const user = await User.findById(userId);
  const userRole = user.jobRole;

  // Got all past user orders
  const allUserOrders = await Order.find({user:userId});
  const length = Object.keys(allUserOrders).length

  // Product ID
  console.log(productId);

  let productCount = 0;
  const product = await Product.findById(productId);

  for(let i=0; i<length; i++) {
    let fetchProduct = allUserOrders[i].items[0].product.id;
    
    if(fetchProduct === productId) {
      productCount++;
    }
  }

  console.log(productCount);

  if(productCount>=3 && userRole==="field") {
    res.status(200).json(productCount);
  } else {
    res.status(200).json(productCount)
  }
} catch (error) {
  console.error("Error in checkProductExistance:", error);
  res.status(500).json({ error: "Internal Server Error" });
}
};

exports.exportUserOrders = async (req, res) => {
  // sort = {_sort:"price",_order="desc"}
  // pagination = {_page:1,_limit=10}
  let query = Order.find({deleted:{$ne:true}});
  let totalOrdersQuery = Order.find({deleted:{$ne:true}});

  
  if (req.query._sort && req.query._order) {
    query = query.sort({ [req.query._sort]: req.query._order });
  }

  const totalDocs = await totalOrdersQuery.count().exec();
  console.log({ totalDocs });

  if (req.query._page && req.query._limit) {
    const pageSize = req.query._limit;
    const page = req.query._page;
    query = query.skip(0).limit(pageSize);
  }

  try {
    // const docs = await query.exec();

    // console.log(docs);

    // res.set('X-Total-Count', totalDocs);
    // res.status(200).json(docs);


    const docs = await query.exec();

  // Iterate through each document in `docs`
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

      // Assuming you want to extract `size.id` from the first item in `items`
      const sizeId = doc.items[0].size.id;
      console.log(sizeId)
      // Add `size` field outside `items` in the document object
      docs[i].selectedAddress.size = sizeId;
    
  }

  // Log the updated documents for debugging (optional)
  console.log('Updated documents:', docs);

  // Respond with updated `docs` array
  res.set('X-Total-Count', totalDocs);
  res.status(200).json(docs);
  } catch (err) {
    res.status(400).json(err);
  }
};