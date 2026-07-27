# Pre-Owned Cars Backend - API Documentation

## Base URL
`/api/v1`

---

## 1. Authentication & Users
**Base Path:** `/auth` & `/users`

### Public Routes
- **POST** `/auth/register`
  Register a new user (buyer, seller, company_seller). Requires body with user details.
- **POST** `/auth/login`
  Authenticate user and receive JWT. Requires `phone`/`email` and `password`.
- **POST** `/auth/verify-otp`
  Verify OTP for registration or password reset.
- **POST** `/auth/resend-otp`
  Resend OTP to phone/email.
- **POST** `/auth/forgot-password`
  Initiate forgot password flow (sends OTP).
- **POST** `/auth/reset-password`
  Reset password after OTP verification.
- **POST** `/auth/refresh-token`
  Get a new access token using a refresh token.

### Protected Routes (Requires JWT)
- **GET** `/users/me`
  Get the current authenticated user's profile.
- **PUT** `/users/me`
  Update profile (allows multipart form data for `profile_picture`).

---

## 2. Cars
**Base Path:** `/cars`

### Public Routes
- **GET** `/cars`
  Get a paginated list of cars. Supports filtering.
- **GET** `/cars/featured`
  Get featured cars.
- **GET** `/cars/:id`
  Get details of a specific car by ID.

### Protected Routes (Requires JWT)
- **GET** `/cars/me`
  Get cars owned/listed by the current user.
- **POST** `/cars`
  Create a new car listing (supports `primary_image` and up to 10 `images`).
- **PUT** `/cars/:id`
  Update a car listing (supports image uploads).
- **DELETE** `/cars/:id`
  Delete a car listing.

---

## 3. Location Metadata
**Base Path:** `/location`

### Public Routes
- **GET** `/location/states`
  Get all states.
- **GET** `/location/cities`
  Get all cities across all states.
- **GET** `/location/states/:stateId/cities`
  Get cities belonging to a specific state ID.

---

## 4. Vehicle Metadata
**Base Path for each category**

### Brands (`/brands`)
- **GET** `/brands` - Get all car brands.
- **GET** `/brands/:id` - Get a specific brand.

### Models (`/models`)
- **GET** `/models` - Get all car models.
- **GET** `/models/:id` - Get a specific model.
- **GET** `/models/brand/:brandId` - Get models by brand ID.

### Fuel Types (`/fuel-types`)
- **GET** `/fuel-types` - Get all fuel types.
- **GET** `/fuel-types/:fuel_type_id` - Get a specific fuel type.

### Transmissions (`/transmissions`)
- **GET** `/transmissions` - Get all transmissions.
- **GET** `/transmissions/:transmission_id` - Get a specific transmission.

### Car Types (`/car-types`)
- **GET** `/car-types` - Get all car types (e.g., SUV, Sedan).
- **GET** `/car-types/:id` - Get a specific car type.

---

## 5. Wishlist
**Base Path:** `/wishlist`
*(All routes require JWT Authentication)*

- **GET** `/wishlist`
  Get the current user's wishlist.
- **POST** `/wishlist`
  Add a car to the wishlist. Requires `{ car_id }` in body.
- **DELETE** `/wishlist/:carId`
  Remove a car from the wishlist.

---

## 6. Admin
**Base Path:** `/admin`
*(All routes require JWT Authentication with `admin` role)*

- **GET** `/admin/cars`
  Get all cars for admin management.
- **GET** `/admin/stats`
  Get dashboard statistics.
- **PUT** `/admin/cars/:id/status`
  Update the status of a car (`active`, `inactive`, `sold`, `pending`).
- **PATCH** `/admin/cars/:id/featured`
  Toggle a car's featured status.
- **GET, POST, PUT, DELETE** `/admin/brands` and `/admin/brands/:id`
  Manage vehicle brands (supports logo upload).
- **Manage other entities** (`/admin/models`, `/admin/fuel-types`, `/admin/transmissions`, `/admin/car-types`)
  Endpoints available to create, update, delete various vehicle metadata.

---

## 7. Utility & Debug
- **GET** `/health`
  Check API health status.
- **GET** `/api/debug/uploads`
  Debug endpoint to check upload directory mappings.
- Static assets (images) are served from `/uploads`.
