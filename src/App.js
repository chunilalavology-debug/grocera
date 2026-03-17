import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles/App.css';


// Components (always loaded)
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AdminLayout from './components/AdminLayout';
import ChatWidget from './components/ChatWidget';
import WishlistDrawer from './components/WishlistDrawer';
import ProductSalePopup from './components/ProductSalePopup';
import ProtectedRoute from './components/ProtectedRoute';

// Critical pages (loaded immediately)
import Login from './pages/Login';
import Register from './pages/Register';
import Refundpolicy from './refundpolicy/RefundPolicy';
import ShippingPolicy from './shippingpolicy/ShippingPolicy';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/resetPassword';
import PrivacyPolicy from './privacypolicy/PrivacyPolicy';
import TermsConditions from './termsconditions/TermsConditions';
import Loader from './services/Loader';
import CategoryDashboard from './pages/admin/Catgories';

// Lazy loaded pages (loaded when needed)
const Home = lazy(() => import('./pages/home/Home'));
const Products = lazy(() => import('./pages/Products'));
const Category = lazy(() => import('./pages/Category'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const HotDeals = lazy(() => import('./pages/HotDeals'));
const ZippyyyShips = lazy(() => import('./pages/ZippyyyShips'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Profile = lazy(() => import('./pages/Profile'));
const Orders = lazy(() => import('./pages/Orders'));
const Payment = lazy(() => import('./pages/Payment'));
const Contact = lazy(() => import('./pages/Contact'));
const AdminInfo = lazy(() => import('./pages/AdminInfo'));
const About = lazy(() => import('./pages/About'));

// Lazy loaded admin pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
// const AdminPricing = lazy(() => import('./pages/AdminPricing'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminContacts = lazy(() => import('./pages/admin/AdminContacts'));

// --- NEW LAZY IMPORTS ---
// Lazy loaded Vouchers page
const AdminVoucher = lazy(() => import('./pages/admin/AdminVoucher'));
// Placeholder for Deals page (Assuming it will be separate from Pricing)
const AdminDeals = lazy(() => import('./pages/admin/AdminDeals'));
// --- END NEW LAZY IMPORTS ---


// Lazy loaded co-admin pages
const CoAdminOrders = lazy(() => import('./pages/admin/CoAdminOrders'));
const CoAdminDashboard = lazy(() => import('./pages/admin/CoAdminDashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));


// Initialize Stripe

function App() {
    const location = useLocation();
    const isAdminArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/co-admin');

    return (
        <div className="App">
            {!isAdminArea && <Navbar />}
            <main className={isAdminArea ? 'main-content main-content--admin' : 'main-content'}>
                <Suspense fallback={<Loader />}>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<Home />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/categories" element={<Category />} />
                        <Route path="/products/:id" element={<ProductDetail />} />
                        <Route path="/hot-deals" element={<HotDeals />} />
                        <Route path="/zippyyy-ships" element={<ZippyyyShips />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/admin-info" element={<AdminInfo />} />
                        <Route path="/about" element={<About />} />

                        {/* Cart & Checkout – no login required */}
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/checkout" element={<Checkout />} />
                        <Route path="/order-success" element={<OrderSuccess />} />
                        <Route path="/profile" element={
                            <ProtectedRoute>
                                <Profile />
                            </ProtectedRoute>
                        } />
                        <Route path="/orders" element={
                            <ProtectedRoute>
                                <Orders />
                            </ProtectedRoute>
                        } />
                        <Route path="/payment" element={<Payment />} />
                        <Route path="/refund-policy" element={<Refundpolicy />} />
                        <Route path="/shipping-policy" element={<ShippingPolicy />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/terms-and-conditions" element={<TermsConditions />} />

                        {/* Protected Admin Routes – own layout (no frontend Navbar/Footer) */}
                        <Route path="/admin" element={
                            <ProtectedRoute adminOnly>
                                <AdminLayout />
                            </ProtectedRoute>
                        }>
                            <Route path="dashboard" element={<AdminDashboard />} />
                            <Route path="categories" element={<CategoryDashboard />} />
                            <Route path="products" element={<AdminProducts />} />
                            <Route path="orders" element={<AdminOrders />} />
                            <Route path="messages" element={<AdminMessages />} />
                            <Route path="users" element={<AdminUsers />} />
                            <Route path="contacts" element={<AdminContacts />} />
                            <Route path="voucher" element={<AdminVoucher />} />
                            <Route path="deals" element={<AdminDeals />} />
                        </Route>

                        {/* Protected Co-Admin Routes */}
                        <Route path="/co-admin/orders" element={
                            <ProtectedRoute coAdminOnly>
                                <CoAdminOrders />
                            </ProtectedRoute>
                        } />
                        <Route path="/co-admin/dashboard" element={
                            <ProtectedRoute coAdminOnly>
                                <CoAdminDashboard />
                            </ProtectedRoute>
                        } />

                        {/* 404 – Not Found */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </main>
            {!isAdminArea && <Footer />}
            {!isAdminArea && <WishlistDrawer />}
            {/* Frontend-only: do not show on admin / co-admin */}
            {!isAdminArea && <ChatWidget />}
            {!isAdminArea && <ProductSalePopup />}
            <Toaster
              position="top-right"
              reverseOrder={false}
              gutter={8}
              toastOptions={{
                className: 'app-toast',
                duration: 2800,
                style: {
                  background: '#1e293b',
                  color: '#e2e8f0',
                  borderRadius: '10px',
                  border: '1px solid rgba(48, 144, 207, 0.3)',
                  padding: '14px 18px',
                  fontSize: '0.9375rem',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                },
                success: {
                  iconTheme: { primary: '#3090cf', secondary: '#1e293b' },
                },
                error: {
                  iconTheme: { primary: '#f87171', secondary: '#1e293b' },
                },
                loading: {
                  iconTheme: { primary: '#3090cf', secondary: '#334155' },
                },
              }}
            />
        </div>
    );
}


export default App;