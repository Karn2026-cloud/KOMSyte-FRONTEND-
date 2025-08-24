// index.js - KOMSYTE Backend (Fully Updated)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ---------------- App Setup ----------------
// In index.js
const app = express(); // ✅ FIX: Initialize the app here, BEFORE using it.

// ✅ Middleware must be set up AFTER the app is created.
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173', process.env.FRONTEND_URL];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// This allows your app to parse JSON request bodies
app.use(express.json());


// ---------------- MongoDB ----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------------- Constants ----------------
const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// ✅ Map your internal plans to the Plan IDs from your Razorpay Dashboard
const RAZORPAY_PLAN_IDS = {
  '1':'plan_R99uzrPRrLAkAw',
  '299':  'plan_R99u9A4JWMrNCj', // 👈 REPLACE WITH YOUR 299 PLAN ID
  '699':  'plan_R99uRhJrIbCLFK', // 👈 REPLACE WITH YOUR 699 PLAN ID
  '1499': 'plan_R99ul63KSocFm1'  // 👈 REPLACE WITH YOUR 1499 PLAN ID
};



// --- Updated PLANS to match requested plan structure and features ---
// keys are strings: 'free', '299', '699', '1499'
const PLANS = {
  free: {
    name: 'Free',
    price: 1,
    maxProducts: 10,
    features: {
      billingHistory: true,
      downloadBill: false,
      updateQuantity: false, // Feature correctly defined
      reports: 'none', // none / simple / all
      whatsappShare: false,
      emailShare: false,
      lowStockAlert: false,
      manualAdd: false,
      topProduct: false
    }
  },
  '299': {
    name: 'Basic',
    price: 299,
    maxProducts: 50,
    features: {
      billingHistory: true,
      downloadBill: true,
      updateQuantity: true, // Feature correctly defined
      reports: 'simple', // 2 KPIs
      whatsappShare: false,
      emailShare: false,
      lowStockAlert: false,
      manualAdd: false,
      topProduct: false
    }
  },
  '699': {
    name: 'Growth',
    price: 699,
    maxProducts: 100,
    features: {
      billingHistory: true,
      downloadBill: true,
      updateQuantity: true, // Feature correctly defined
      reports: 'all', // 6 KPIs + graphs
      whatsappShare: true,
      emailShare: false,
      lowStockAlert: true,
      manualAdd: true,
      topProduct: true
    }
  },
  '1499': {
    name: 'Premium',
    price: 1499,
    maxProducts: Infinity,
    features: {
      billingHistory: true,
      downloadBill: true,
      updateQuantity: true, // Feature correctly defined
      reports: 'all',
      whatsappShare: true,
      emailShare: true,
      lowStockAlert: true,
      manualAdd: true,
      topProduct: true
    }
  }
};

const amountInPaise = rupee => Math.round(Number(rupee) * 100);

// ---------------- Razorpay Setup ----------------
const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

// ---------------- Nodemailer Setup ----------------
const transporter = (EMAIL_USER && EMAIL_PASS) ? nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
}) : null;

// ---------------- Schemas ----------------
// ---------------- Schemas ----------------
// ✅ Updated Subscription Schema
const subscriptionSchema = new mongoose.Schema({
  plan: { type: String, enum: Object.keys(PLANS), default: 'free' },
  status: { type: String, enum: ['inactive', 'active', 'canceled', 'halted'], default: 'inactive' },
  startDate: Date,
  nextBillingDate: Date,
  razorpayPaymentId: String,
  razorpaySubscriptionId: String, // To link to Razorpay's subscription
}, { _id: false });

const shopSchema = new mongoose.Schema({
  shopName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  subscription: { type: subscriptionSchema, default: { plan: 'free', status: 'active' } }, // Free plan is active by default
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  barcode: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
});
productSchema.index({ shopId: 1, barcode: 1 }, { unique: true });

const billSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  receiptNo: { type: String, required: true },
  items: [{ barcode: String, name: String, price: Number, quantity: Number, subtotal: Number }],
  totalAmount: Number,
  customerMobile: String,
  shopName: String,
}, { timestamps: true });

const Shop = mongoose.model('Shop', shopSchema);
const Product = mongoose.model('Product', productSchema);
const Bill = mongoose.model('Bill', billSchema);

// ---------------- Ensure Product Index ----------------
async function ensureProductIndex() {
  try {
    await Product.collection.createIndex({ shopId: 1, barcode: 1 }, { unique: true });
    console.log('✅ Composite index ensured: {shopId, barcode}');
  } catch (err) {
    console.error('❌ Product index error:', err.message);
  }
}
ensureProductIndex().catch(e => console.error('Index ensure error:', e));

// ---------------- Middleware ----------------
function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || req.headers['x-access-token'] || '';
    let token = null;
    if (auth && auth.startsWith('Bearer ')) token = auth.split(' ')[1];
    else if (auth) token = auth;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.shopId) return res.status(401).json({ error: 'Invalid token payload' });
    req.shopId = decoded.shopId;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * subscriptionMiddleware(requiredPlans = [], maxProducts = null)
 * - This middleware also attaches `req.planConfig` for downstream checks.
 */
function subscriptionMiddleware(requiredPlans = []) {
  return async (req, res, next) => {
    try {
      const shop = await Shop.findById(req.shopId);
      if (!shop) return res.status(404).json({ error: 'Shop not found' });

      const planKey = shop.subscription?.plan || 'free';
      const planConfig = PLANS[planKey];
      if (!planConfig) return res.status(400).json({ error: 'Invalid plan configured' });

      if (requiredPlans.length && !requiredPlans.includes(planKey)) {
        return res.status(403).json({ error: `Feature available only for ${requiredPlans.join(', ')} plan(s).` });
      }

      if (planKey !== 'free') {
        const status = shop.subscription?.status || 'inactive';
        if (status !== 'active') {
          return res.status(403).json({ error: 'Subscription inactive. Please confirm payment.' });
        }
      }

      req.planConfig = planConfig;
      req.planKey = planKey;
      next();
    } catch (err) {
      console.error('Subscription middleware error:', err);
      res.status(500).json({ error: 'Server error checking subscription' });
    }
  };
}

const upload = multer({ storage: multer.memoryStorage() });

// ---------------- Helper Functions ----------------
function generateReceiptNo(shopName) {
  return `${(shopName || 'SHOP').toUpperCase().replace(/\s+/g, '')}_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`;
}

async function sendExpiryEmail(shop) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to: shop.email,
      subject: `Subscription Expiry Reminder - ${shop.shopName}`,
      text: `Hello ${shop.shopName},\n\nYour subscription (${shop.subscription.plan}) will expire on ${shop.subscription.nextBillingDate?.toDateString() || 'soon'}.\nPlease renew.\n\nThanks,\nKOMSYTE Team`
    });
    console.log(`📧 Reminder email sent to ${shop.email}`);
  } catch (err) { console.error(`❌ Failed to send email:`, err.message); }
}

async function checkSubscriptions() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiring = await Shop.find({ 'subscription.nextBillingDate': { $lte: tomorrow }, 'subscription.status': 'active' });
    for (const shop of expiring) await sendExpiryEmail(shop);
  } catch (err) { console.error('Subscription check error:', err); }
}
setInterval(checkSubscriptions, 24 * 60 * 60 * 1000); // Daily check

// ---------------- Routes ----------------

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    let { shopName, email, password } = req.body;
    if (!shopName || !email || !password) return res.status(400).json({ error: 'All fields required' });

    email = email.trim().toLowerCase();
    if (await Shop.findOne({ email })) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const shop = await new Shop({ shopName, email, password: hashedPassword }).save();
    const token = jwt.sign({ shopId: shop._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) { console.error('Signup error:', err); res.status(500).json({ error: 'Server error' }); }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

    email = email.trim().toLowerCase();
    const shop = await Shop.findOne({ email });
    if (!shop) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, shop.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ shopId: shop._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }); }
});

// Profile
app.get(['/api/me', '/api/profile'], authMiddleware, async (req, res) => {
  try {
    const shop = await Shop.findById(req.shopId).select('-password');
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    res.json(shop);
  } catch (err) { console.error('Fetch profile error:', err); res.status(500).json({ error: 'Failed to fetch profile' }); }
});

// Plans
app.get('/api/plans', (_, res) => res.json({ plans: Object.entries(PLANS).map(([id, val]) => ({ id, ...val })) }));


// ✅ This NEW route replaces your old '/api/subscribe'
app.post("/api/create-subscription", authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const planId = RAZORPAY_PLAN_IDS[plan];
    if (!planId) return res.status(400).json({ error: "Invalid plan selected" });

    const shop = await Shop.findById(req.shopId);
    if (!shop) return res.status(404).json({ error: "Shop not found" });

    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // Authorize for 12 monthly payments
    });

    // Update the shop's subscription details
    shop.subscription.plan = plan;
    shop.subscription.razorpaySubscriptionId = subscription.id;
    shop.subscription.status = 'inactive'; // Status becomes 'active' after first payment via webhook
    await shop.save();

    res.json({
      key_id: RAZORPAY_KEY_ID,
      subscription_id: subscription.id,
      shopName: shop.shopName,
      email: shop.email
    });

  } catch (err) {
    console.error("Create subscription error:", err);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

// ✅ This NEW route handles ALL payment confirmations automatically
app.post("/api/razorpay-webhook", async (req, res) => {
  const secret = RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  try {
    const isValid = Razorpay.utils.validateWebhookSignature(JSON.stringify(req.body), signature, secret);

    if (isValid) {
      const event = req.body.event;
      const payload = req.body.payload;
      
      console.log(`Webhook received for event: ${event}`);

      // Event for successful recurring payments
      if (event === 'subscription.charged') {
        const subscriptionId = payload.subscription.entity.id;
        const paymentId = payload.payment.entity.id;

        const shop = await Shop.findOne({ 'subscription.razorpaySubscriptionId': subscriptionId });
        if (shop) {
          shop.subscription.status = 'active';
          shop.subscription.razorpayPaymentId = paymentId;
          
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          shop.subscription.nextBillingDate = nextBillingDate;
          if(!shop.subscription.startDate) shop.subscription.startDate = new Date();
          
          await shop.save();
          console.log(`Subscription for ${shop.shopName} successfully renewed.`);
        }
      }
      
      // Event for when a subscription is stopped due to payment failure
      if (event === 'subscription.halted') {
          const subscriptionId = payload.subscription.entity.id;
          await Shop.findOneAndUpdate(
            { 'subscription.razorpaySubscriptionId': subscriptionId },
            { $set: { 'subscription.status': 'halted' } }
          ).exec();
      }

      res.json({ status: 'ok' });

    } else {
      res.status(400).send('Invalid webhook signature');
    }
  } catch(error) {
    console.error("Webhook processing error:", error);
    res.status(500).send('Webhook processing error');
  }
});

// ---------------- Products ----------------

// ---------------- Products Handler (UPDATED) ----------------
async function handleAddOrUpdateProduct(req, res) {
  try {
    const { barcode, name, price, quantity, updateStock } = req.body;
    if (!barcode) return res.status(400).json({ error: 'Barcode required' });

    // req.planConfig is available from subscriptionMiddleware
    const planConfig = req.planConfig;
    const planMax = planConfig.maxProducts || 0;

    let product = await Product.findOne({ shopId: req.shopId, barcode });

    if (updateStock) {
      // ✅ FIX: Check if the user's plan allows quantity updates.
      if (!planConfig.features.updateQuantity) {
          return res.status(403).json({ error: 'Updating product quantity is not available on your current plan. Please upgrade.' });
      }

      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (quantity == null || quantity < 0) return res.status(400).json({ error: 'Invalid quantity' });

      product.quantity += Number(quantity);
      product.lastUpdated = new Date();
      await product.save();
      return res.json({ message: 'Stock updated', product });
    } else {
      // Adding a new product
      if (!name || price == null || price <= 0 || quantity == null || quantity < 0)
        return res.status(400).json({ error: 'Invalid fields for new product' });

      if (product) return res.status(409).json({ error: 'Product with this barcode already exists' });

      if ((await Product.countDocuments({ shopId: req.shopId })) >= planMax) {
        return res.status(403).json({ error: `Your plan's limit of ${planMax} products has been reached. Please upgrade.` });
      }

      const newProduct = new Product({ shopId: req.shopId, barcode, name, price, quantity, lastUpdated: new Date() });
      await newProduct.save();
      return res.status(201).json({ message: 'Product added successfully', product: newProduct });
    }
  } catch (err) {
    console.error('Product add/update error:', err);
    res.status(500).json({ error: 'Server error handling product' });
  }
}

// ---------------- Products Routes ----------------
// Both routes now correctly pass through the subscription middleware before hitting the handler.
app.post('/api/stock', authMiddleware, subscriptionMiddleware(), handleAddOrUpdateProduct);
app.post('/api/products', authMiddleware, subscriptionMiddleware(), handleAddOrUpdateProduct);

// Bulk upload
app.post('/api/stock/upload', authMiddleware, subscriptionMiddleware(['299', '699', '1499']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    if (!sheet.length) return res.status(400).json({ error: 'Excel file is empty' });
    
    // req.planConfig is available from subscriptionMiddleware
    const planMax = req.planConfig.maxProducts || Infinity;
    let productCount = await Product.countDocuments({ shopId: req.shopId });
    const results = [];

    for (const row of sheet) {
      const { barcode, name, price, quantity } = row;
      if (!barcode || !name || price == null || quantity == null) {
        results.push({ barcode, status: 'skipped', reason: 'Missing fields' });
        continue;
      }

      let product = await Product.findOne({ shopId: req.shopId, barcode });
      if (product) {
        product.quantity += Number(quantity);
        product.lastUpdated = new Date();
        await product.save();
        results.push({ barcode, status: 'updated' });
      } else {
        if (productCount >= planMax) {
          results.push({ barcode, status: 'skipped', reason: `Plan limit reached (${planMax} products)` });
          continue;
        }
        const newProduct = new Product({ shopId: req.shopId, barcode, name, price: Number(price), quantity: Number(quantity), lastUpdated: new Date() });
        await newProduct.save();
        productCount++;
        results.push({ barcode, status: 'added' });
      }
    }

    res.json({ message: 'Bulk upload completed', results });
  } catch (err) { console.error('Bulk upload error:', err); res.status(500).json({ error: 'Server error during bulk upload' }); }
});

// Delete Product
app.delete('/api/stock/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOneAndDelete({ _id: id, shopId: req.shopId });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) { console.error('Delete product error:', err); res.status(500).json({ error: 'Server error' }); }
});

// Get Stock
app.get('/api/stock', authMiddleware, async (req, res) => {
  try {
    const products = await Product.find({ shopId: req.shopId });
    res.json(products);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch stock' }); }
});

// Update stock by barcode (UPDATED)
// ✅ FIX: Added subscriptionMiddleware and plan feature check.
app.put('/api/stock/:barcode', authMiddleware, subscriptionMiddleware(), async (req, res) => {
  try {
    // ✅ FIX: Check if the user's plan allows quantity updates.
    if (!req.planConfig.features.updateQuantity) {
        return res.status(403).json({ error: 'Updating product quantity is not available on your current plan. Please upgrade.' });
    }
      
    const { barcode } = req.params;
    const { quantity, operation } = req.body;
    if (quantity == null || isNaN(Number(quantity))) return res.status(400).json({ error: 'Invalid quantity' });

    const product = await Product.findOne({ shopId: req.shopId, barcode });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const q = Number(quantity);
    if (operation === 'set') {
      if (q < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
      product.quantity = q;
    } else if (operation === 'increment') {
      product.quantity += q;
    } else { // 'decrement' is the default
      if (product.quantity < q) return res.status(400).json({ error: 'Insufficient stock' });
      product.quantity -= q;
    }
    product.lastUpdated = new Date();
    await product.save();
    res.json({ message: 'Stock updated', product });
  } catch (err) { console.error('Stock update error:', err); res.status(500).json({ error: 'Failed to update stock' }); }
});

// ---------------- Billing ----------------

// Create / Finalize a Bill
app.post('/api/bills', authMiddleware, subscriptionMiddleware(), async (req, res) => {
  try {
    const { receiptNo, items, customerMobile, shopName } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'No items provided' });
    
    const planConfig = req.planConfig; // from middleware
    const billItems = [];
    let computedTotal = 0;

    for (const it of items) {
      const { barcode, quantity, name, price } = it;

      if (barcode) {
        if (quantity == null || isNaN(Number(quantity)) || Number(quantity) <= 0)
          return res.status(400).json({ error: `Invalid item data for barcode ${barcode}` });

        const product = await Product.findOne({ shopId: req.shopId, barcode });
        if (!product) return res.status(400).json({ error: `Product not found: ${barcode}` });
        if (product.quantity < Number(quantity)) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });

        const subtotal = Number(product.price) * Number(quantity);
        billItems.push({ barcode, name: product.name, price: Number(product.price), quantity: Number(quantity), subtotal });
        computedTotal += subtotal;
      } else {
        if (!planConfig.features.manualAdd) {
          return res.status(403).json({ error: 'Manual product adding during billing is not available on your plan. Upgrade to access this feature.' });
        }

        if (!name || price == null || isNaN(Number(price)) || Number(price) <= 0 || quantity == null || isNaN(Number(quantity)) || Number(quantity) <= 0)
          return res.status(400).json({ error: 'Invalid manual product data' });

        const subtotal = Number(price) * Number(quantity);
        billItems.push({ barcode: '', name, price: Number(price), quantity: Number(quantity), subtotal });
        computedTotal += subtotal;
      }
    }

    // Update stock for existing products only
    for (const it of billItems) {
      if (it.barcode) {
        await Product.findOneAndUpdate(
          { shopId: req.shopId, barcode: it.barcode },
          { $inc: { quantity: -it.quantity }, $set: { lastUpdated: new Date() } }
        );
      }
    }

    const shop = await Shop.findById(req.shopId);
    const finalReceipt = receiptNo || generateReceiptNo(shop.shopName);

    const bill = new Bill({
      shopId: req.shopId,
      receiptNo: finalReceipt,
      items: billItems,
      totalAmount: computedTotal,
      customerMobile: customerMobile || null,
      shopName: shopName || shop.shopName
    });

    await bill.save();

    res.status(201).json({
      message: 'Bill finalized successfully',
      bill
    });

  } catch (err) {
    console.error('Finalize bill error:', err);
    res.status(500).json({ error: 'Server error while finalizing bill' });
  }
});

// Get all bills for a shop (recent 200)
app.get('/api/bills', authMiddleware, async (req, res) => {
  try {
    const bills = await Bill.find({ shopId: req.shopId }).sort({ createdAt: -1 }).limit(200);
    res.json(bills);
  } catch (err) {
    console.error('Fetch bills error:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// Get a single bill by ID
app.get('/api/bills/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await Bill.findOne({ _id: id, shopId: req.shopId });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    console.error('Fetch bill error:', err);
    res.status(500).json({ error: 'Failed to fetch bill' });
  }
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));