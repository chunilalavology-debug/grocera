import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/App.css';

// Components (always loaded)
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Critical pages (loaded immediately)
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

// Lazy loaded pages (loaded when needed)
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
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
const AdminPricing = lazy(() => import('./pages/AdminPricing'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminContacts = lazy(() => import('./pages/admin/AdminContacts'));

// Lazy loaded co-admin pages
const CoAdminOrders = lazy(() => import('./pages/admin/CoAdminOrders'));
const CoAdminDashboard = lazy(() => import('./pages/admin/CoAdminDashboard'));

// Loading component
const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="loading-spinner">
      <div className="spinner"></div>
    </div>
    <p>Loading...</p>
  </div>
);

// Initialize Stripe

function App() {
  return (


    <div className="App">
      <Navbar />
      <main className="main-content">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin-info" element={<AdminInfo />} />
            <Route path="/about" element={<About />} />

            {/* Protected Customer Routes */}
            <Route path="/cart" element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            } />
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

            {/* Protected Admin Routes */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/pricing" element={
              <ProtectedRoute adminOnly>
                <AdminPricing />
              </ProtectedRoute>
            } />
            <Route path="/admin/products" element={
              <ProtectedRoute adminOnly>
                <AdminProducts />
              </ProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <ProtectedRoute adminOnly>
                <AdminOrders />
              </ProtectedRoute>
            } />
            <Route path="/admin/messages" element={
              <ProtectedRoute adminOnly>
                <AdminMessages />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute adminOnly>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/admin/contacts" element={
              <ProtectedRoute adminOnly>
                <AdminContacts />
              </ProtectedRoute>
            } />

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

            {/* Fallback Route */}
            <Route path="*" element={<div className="not-found">Page Not Found</div>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default App;