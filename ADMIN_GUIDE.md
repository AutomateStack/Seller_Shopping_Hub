# Admin Portal Guide

Welcome to your e-commerce admin portal! This guide will help you manage your store effectively.

## 🔐 Accessing the Admin Portal

1. Navigate to `/admin` in your application
2. You must be logged in with an account that has admin privileges
3. If you don't have admin access, you'll be redirected to the home page

## 📊 Dashboard Overview

The Dashboard is your command center, providing key metrics at a glance:

### Key Statistics Cards

- **Total Revenue**: Shows all-time revenue from all orders
- **Total Orders**: Complete count of orders placed
- **Pending Orders**: Number of orders awaiting processing
- **Total Products**: Total products in your catalog

### Quick Views

- **Recent Orders**: Last 5 orders with customer name, amount, and status
- **Low Stock Products**: Products with inventory below 10 units (alerts you to restock)

## 📦 Product Management

### Adding a New Product

1. Go to the **Products** tab
2. Click the **"Add Product"** button
3. Fill in the product details:
   - **Name** (required): Product name
   - **Description**: Detailed product description
   - **Price** (required): Product price in dollars
   - **Stock** (required): Available quantity
   - **Category**: Product category (e.g., Electronics, Clothing, etc.)
   - **Image**: Either upload an image file OR paste an image URL
   - **Featured**: Toggle to mark as a featured product
4. Click **"Save Product"**

### Editing a Product

1. Find the product in the products grid
2. Click the **Edit** button (pencil icon)
3. Modify the desired fields
4. Click **"Save Product"**

### Deleting a Product

1. Find the product in the products grid
2. Click the **Delete** button (trash icon)
3. Confirm the deletion

### Search & Filter

- **Search Bar**: Search products by name or description
- **Category Filter**: Filter products by category
- The grid updates in real-time as you type or select filters

## 📋 Order Management

### Viewing Orders

The Orders tab displays all orders in a table format showing:
- **Order ID**: Unique identifier (first 8 characters)
- **Customer**: Guest name or email
- **Total**: Order total amount
- **Status**: Current order status with dropdown
- **Date**: When the order was placed

### Updating Order Status

1. Find the order you want to update
2. Click the status dropdown in the Status column
3. Select the new status:
   - **Pending**: Order received, not yet processed
   - **Processing**: Order is being prepared
   - **Shipped**: Order has been shipped
   - **Delivered**: Order delivered to customer
   - **Cancelled**: Order was cancelled

The status updates immediately.

### Viewing Order Details

1. Click the **"View Details"** button on any order
2. A detailed dialog will open showing:

   **Customer Information:**
   - Name
   - Email
   - Phone number

   **Order Information:**
   - Full Order ID
   - Current status
   - Order date
   - Total amount

   **Shipping Address:**
   - Complete address with city, state, and zip code

   **Order Items:**
   - Product names
   - Individual prices
   - Quantities
   - Subtotals per item

   **Payment Information (if available):**
   - Payment ID
   - Payment status

## 💡 Best Practices

### Product Management
- Always add clear, high-quality product images
- Write detailed descriptions to help customers
- Keep stock quantities updated
- Use consistent category names
- Mark your best sellers as "Featured"
- Monitor the Low Stock alert and restock promptly

### Order Management
- Process pending orders promptly
- Update order status as they progress
- Use the order details to verify shipping information
- Check order details before marking as shipped

### Inventory Tips
- Check the Dashboard's "Low Stock Products" section daily
- Restock products before they hit zero
- Consider marking low-stock items on sale

## 🔍 Quick Actions

- **Search Products**: Use the search bar to find products quickly
- **Filter by Category**: Narrow down products by category
- **Batch Status Updates**: Update order statuses directly from the table
- **View Recent Orders**: Check the Dashboard for the latest 5 orders

## 🛡️ Security Notes

- Only users with admin role can access this portal
- All actions are logged and tied to your account
- Guest customer information is protected and only visible to admins
- Product images are securely stored in cloud storage

## 📈 Understanding Order Statuses

| Status | Meaning | Next Action |
|--------|---------|-------------|
| Pending | New order received | Review and start processing |
| Processing | Order is being prepared | Prepare items for shipping |
| Shipped | Package sent to customer | Track delivery |
| Delivered | Customer received order | Order complete |
| Cancelled | Order was cancelled | Handle refund if needed |

## 🎯 Tips for Success

1. **Check Dashboard Daily**: Review key metrics and pending orders
2. **Maintain Stock Levels**: Never let popular items go out of stock
3. **Process Orders Quickly**: Update statuses to keep customers informed
4. **Use Good Images**: Quality product photos increase sales
5. **Organize with Categories**: Makes products easier to find
6. **Feature Best Sellers**: Use the Featured toggle for top products

## ❓ Common Questions

**Q: How do I give someone admin access?**
A: Admin roles must be added directly to the `user_roles` table in the database.

**Q: Can I delete an order?**
A: Currently, orders can only be cancelled, not deleted. This maintains order history.

**Q: What image formats are supported?**
A: JPG, PNG, WEBP, and GIF formats are supported for product images.

**Q: Can I export order data?**
A: Currently, you can view all order details in the portal. Export functionality may be added in future updates.

**Q: How do I restore deleted products?**
A: Deleted products cannot be restored. Create a new product with the same details if needed.

---

**Need help?** If you encounter any issues or have questions, contact your technical support team.
