# Admin API Integration Report & Specification for Frontend

> **Target Audience:** Frontend Engineers (`React`, `Vue`, `Next.js`, Flutter, etc.)  
> **Backend Service:** Pre-Owned Cars Backend  
> **API Version:** v1 (`/api/v1/...` and `/api/...` aliases supported)  
> **Auth Scheme:** JWT Bearer Token (`Authorization: Bearer <token>`)  
> **Required Role:** `admin`

---

## 1. Overview & General Standards

### 1.1 Base URLs
- **Local Development:** `http://localhost:5000/api/v1` (or `http://localhost:5000/api`)
- **Staging / Production:** `https://your-domain.com/api/v1`

### 1.2 Authentication & Headers
All Admin endpoints are protected by `protect` and `adminOnly` middlewares.
```http
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```
For file uploads (Banners, Brand Logos), use:
```http
Authorization: Bearer <admin_jwt_token>
Content-Type: multipart/form-data
```

### 1.3 Standard Response Format
**Success Response:**
```json
{
  "status": "success",
  "data": { ... }
}
```
*(Note: Some controllers also include `"success": true` or `"message": "..."`)*

**Error Response:**
```json
{
  "status": "fail" | "error",
  "message": "Descriptive error message"
}
```
Common HTTP Status Codes:
- `200 OK` / `201 Created` / `204 No Content`
- `400 Bad Request` (Joi validation failure / invalid inputs)
- `401 Unauthorized` (Missing or expired JWT)
- `403 Forbidden` (User is not an `admin`)
- `404 Not Found` (Resource does not exist)

---

## 2. Admin API Endpoints Summary

| Method | Endpoint | Description | Content-Type |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/traffic` | App & platform analytics (users, cars, enquiries) | `application/json` |
| **GET** | `/admin/users/pending/count` | Total count of users awaiting approval | `application/json` |
| **GET** | `/admin/users/pending` | Paginated list of pending user accounts | `application/json` |
| **PATCH**| `/admin/users/:id/approve` | Approve a pending user account | `application/json` |
| **PATCH**| `/admin/users/:id/reject` | Reject a user account with optional reason | `application/json` |
| **GET** | `/admin/dealers` | Paginated list of registered dealers with profile | `application/json` |
| **GET** | `/admin/dealers/:id` | Single dealer full profile | `application/json` |
| **GET** | `/admin/dealers/:dealerId/cars` | All cars posted by a specific dealer | `application/json` |
| **GET** | `/admin/enquiries` | All buyer leads & enquiries platform-wide | `application/json` |
| **GET** | `/admin/requirements` | All buyer car requirements with filters | `application/json` |
| **GET** | `/admin/car-reports` | Flagged & reported car listings | `application/json` |
| **GET** | `/admin/car-reports/:id` | Single flagged car report details | `application/json` |
| **PATCH**| `/admin/car-reports/:id` | Update report status & resolution notes | `application/json` |
| **GET** | `/admin/report-reasons` | List of report reasons for dropdown/admin | `application/json` |
| **GET** | `/admin/report-reasons/:id` | Single report reason details | `application/json` |
| **POST** | `/admin/report-reasons` | Create a new report reason | `application/json` |
| **PATCH**| `/admin/report-reasons/:id` | Update an existing report reason | `application/json` |
| **DELETE**| `/admin/report-reasons/:id` | Delete a report reason | `application/json` |
| **GET** | `/admin/banners` | Get all promotional banners | `application/json` |
| **POST** | `/admin/banners` | Create a banner with image upload | `multipart/form-data` |
| **PUT** | `/admin/banners/:id` | Update a banner and/or replace image | `multipart/form-data` |
| **POST** | `/admin/banners/reorder` | Reorder display order of banners | `application/json` |
| **DELETE**| `/admin/banners/:id` | Delete a banner | `application/json` |
| **GET** | `/admin/highlights` | List all car highlight tags | `application/json` |
| **GET** | `/admin/highlights/:id` | Single highlight tag details | `application/json` |
| **POST** | `/admin/highlights` | Create a new car highlight tag | `application/json` |
| **PUT** | `/admin/highlights/:id` | Full update of highlight tag | `application/json` |
| **PATCH**| `/admin/highlights/:id` | Quick toggle `is_active` status | `application/json` |
| **DELETE**| `/admin/highlights/:id` | Delete a car highlight tag | `application/json` |
| **POST** | `/catalog/brands` | Create brand with logo upload | `multipart/form-data` |
| **POST** | `/catalog/sync` | Trigger external vehicle catalog sync | `application/json` |
| **GET** | `/admin/subscriptions` | All seller subscriptions overview | `application/json` |
| **GET** | `/admin/payments` | Completed subscription payments audit | `application/json` |

---

## 3. Module Details & Payload Specifications

### 3.1 Dashboard & Traffic Analytics
#### `GET /api/v1/admin/traffic`
Returns real-time platform statistics for the admin dashboard.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "dealers": 180,
      "customers": 1070,
      "registered_today": 12,
      "registered_this_week": 85,
      "registered_this_month": 340
    },
    "enquiries": {
      "total": 450,
      "from_registered_users": 380,
      "from_guests": 70,
      "today": 15,
      "this_week": 92
    },
    "cars": {
      "total": 310,
      "active": 280,
      "inactive": 30
    }
  }
}
```

---

### 3.2 User Approval Workflow

#### `GET /api/v1/admin/users/pending/count`
Returns the badge count of users awaiting admin review.
**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "count": 7
  }
}
```

#### `GET /api/v1/admin/users/pending`
Returns a paginated list of pending users with attached customer and dealer profiles.

**Query Parameters:**
- `page` (optional, default `1`): page number
- `limit` (optional, default `20`): items per page
- `search` (optional): search by `full_name`, `phone`, or `email`

**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "users": [
      {
        "id": "c76f0d3b-9e4a-44fa-8cf6-b788a1835759",
        "full_name": "Rajesh Kumar",
        "email": "rajesh@autodealer.com",
        "phone": "+919876543210",
        "role": "dealer",
        "status": "pending",
        "city": "Bengaluru",
        "state": "Karnataka",
        "created_at": "2026-10-14T08:30:00.000Z",
        "dealerProfile": {
          "dealership_name": "Kumar Pre-Owned Motors",
          "gst_number": "29ABCDE1234F1Z5",
          "address": "MG Road, Indiranagar"
        },
        "customerProfile": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 7,
      "totalPages": 1
    }
  }
}
```

#### `PATCH /api/v1/admin/users/:id/approve`
Approves a user account, changing status to `approved`.
- **Path Param:** `:id` (User UUID)
- **Body:** None

**Response `200 OK`:**
```json
{
  "status": "success",
  "message": "User approved successfully",
  "data": {
    "user": {
      "id": "c76f0d3b-9e4a-44fa-8cf6-b788a1835759",
      "status": "approved"
    }
  }
}
```

#### `PATCH /api/v1/admin/users/:id/reject`
Rejects a user account, changing status to `rejected`.
- **Path Param:** `:id` (User UUID)
- **Body (`application/json`):**
```json
{
  "reason": "Invalid or unverified GST number provided."
}
```

**Response `200 OK`:**
```json
{
  "status": "success",
  "message": "User rejected successfully",
  "data": {
    "user": {
      "id": "c76f0d3b-9e4a-44fa-8cf6-b788a1835759",
      "status": "rejected"
    },
    "rejection_reason": "Invalid or unverified GST number provided."
  }
}
```

---

### 3.3 Dealer Management

#### `GET /api/v1/admin/dealers`
**Query Parameters:**
- `page` (number, default `1`)
- `limit` (number, default `20`)
- `status` (string, e.g. `approved`, `pending`, `rejected`)
- `search` (string, searches name/phone/email)

**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "dealers": [
      {
        "id": "11111111-2222-3333-4444-555555555555",
        "full_name": "Apex Motors",
        "email": "contact@apexmotors.in",
        "phone": "+919876500000",
        "role": "dealer",
        "status": "approved",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "dealerProfile": {
          "id": "...",
          "dealership_name": "Apex Auto Pvt Ltd",
          "gst_number": "33AAACA1111A1Z1"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

#### `GET /api/v1/admin/dealers/:id`
Returns single dealer profile with complete dealership info.

#### `GET /api/v1/admin/dealers/:dealerId/cars`
Returns all cars listed by this dealer.
**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "cars": [
      {
        "id": "car-uuid-1",
        "title": "2021 Hyundai Creta SX Opt",
        "price": 1450000,
        "status": "active",
        "primary_image": "https://res.cloudinary.com/..."
      }
    ]
  }
}
```

---

### 3.4 Enquiries & Leads

#### `GET /api/v1/admin/enquiries`
Platform-wide list of buyer inquiries.

**Query Parameters:**
- `page` (number, default `1`)
- `limit` (number, default `20`)
- `status` (e.g. `new`, `contacted`, `converted`, `closed`, `cancelled`)
- `seller_id` (UUID)
- `car_id` (UUID)
- `start_date` (ISO date `YYYY-MM-DD`)
- `end_date` (ISO date `YYYY-MM-DD`)
- `search` (searches buyer name, phone, email, contact phone)

**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6,
    "leads": [
      {
        "id": "lead-uuid-1",
        "buyer_name": "Suresh",
        "buyer_phone": "+919999988888",
        "buyer_email": "suresh@example.com",
        "status": "new",
        "message": "Is this car accident-free?",
        "created_at": "2026-10-15T09:15:00.000Z",
        "car": {
          "id": "car-uuid-1",
          "name": "Maruti Swift VXi",
          "year": 2020,
          "price": 580000,
          "status": "active",
          "primary_image": "https://res.cloudinary.com/...",
          "metrics": { "views": 150 }
        },
        "seller": {
          "id": "seller-uuid",
          "full_name": "Apex Motors",
          "phone": "+919876500000",
          "role": "dealer"
        },
        "buyer": {
          "id": "buyer-uuid",
          "full_name": "Suresh",
          "phone": "+919999988888"
        }
      }
    ]
  }
}
```

---

### 3.5 Buying Requirements

#### `GET /api/v1/admin/requirements`
Platform-wide buying requirements submitted by prospective car buyers.

**Query Parameters:**
- `page` (number, default `1`)
- `limit` (number, default `20`)
- `status` (`active`, `bought`, `expired`, `deleted`)
- `user_id` (UUID)
- `start_date` / `end_date` (ISO dates)

**Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "requirements": [
      {
        "id": "req-uuid-1",
        "min_price": 500000,
        "max_price": 800000,
        "min_km": 0,
        "max_km": 50000,
        "body_type": "SUV",
        "transmission": "Automatic",
        "board_type": "White",
        "status": "active",
        "user": {
          "id": "user-uuid",
          "full_name": "Anand R",
          "phone": "+919888877777",
          "email": "anand@gmail.com"
        },
        "brand": { "id": "brand-uuid", "name": "Hyundai" },
        "carModel": { "id": "model-uuid", "name": "Venue" }
      }
    ]
  }
}
```

---

### 3.6 Flagged Car Reports (Listing Moderation)

#### `GET /api/v1/admin/car-reports` *(Also aliased at `/api/v1/admin/reports`)*
**Query Parameters:**
- `page` (default `1`)
- `limit` (default `20`, max `100`)
- `status` (`pending`, `in_review`, `resolved`, `dismissed`)
- `car_id` (UUID)
- `dealer_id` (UUID)
- `reason` (string, e.g., `car_sold_out`, `overpriced_car`, `fraudulent_listing`)
- `sortBy` (`created_at`, `updated_at`, `status`)
- `sortOrder` (`ASC` or `DESC`, default `DESC`)

**Response `200 OK`:**
```json
{
  "status": "success",
  "success": true,
  "data": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "reports": [
      {
        "id": "report-uuid-1",
        "reason": "car_sold_out",
        "description": "Dealer informed on phone that car was already sold last week.",
        "status": "pending",
        "reporter_name": "Vikram",
        "reporter_phone": "9876543210",
        "admin_notes": null,
        "created_at": "2026-10-15T07:10:00.000Z",
        "car": {
          "id": "car-uuid",
          "price": 850000,
          "year": 2019,
          "status": "active",
          "brand": { "name": "Honda" },
          "carModel": { "name": "City" },
          "images": [{ "image_url": "https://res.cloudinary.com/...", "is_primary": true }]
        },
        "dealer": {
          "id": "dealer-uuid",
          "full_name": "Star Cars",
          "phone": "+919876512345"
        }
      }
    ]
  }
}
```

#### `GET /api/v1/admin/car-reports/:id`
Returns single report details.

#### `PATCH /api/v1/admin/car-reports/:id`
Updates resolution status or adds notes.

**Request Body (`application/json`):**
```json
{
  "status": "resolved",
  "admin_notes": "Contacted seller; marked car as sold in database."
}
```
*Allowed statuses: `pending`, `in_review`, `resolved`, `dismissed`.*

---

### 3.7 Report Reasons (Configuration CRUD)

#### `GET /api/v1/admin/report-reasons`
**Query Parameters:**
- `page`, `limit`
- `search`
- `is_active` / `isActive` (`true` or `false`)

#### `POST /api/v1/admin/report-reasons`
Creates a new option for users when reporting listings.

**Request Body (`application/json`):**
```json
{
  "label": "Odometer Tampered",
  "value": "odometer_tampered",
  "is_active": true,
  "sort_order": 5,
  "description": "Car has suspicious mileage discrepancy"
}
```
*Note: `value` MUST be lowercase snake_case (e.g. `car_sold_out`).*

#### `PATCH /api/v1/admin/report-reasons/:id`
Updates any field (`label`, `value`, `is_active`, `sort_order`, `description`).

#### `DELETE /api/v1/admin/report-reasons/:id`
Deletes a report reason.

---

### 3.8 Promotional Banners Management

#### `GET /api/v1/admin/banners`
Returns all banners ordered by `order ASC`.
```json
{
  "status": "success",
  "data": [
    {
      "id": "banner-uuid",
      "image_url": "https://res.cloudinary.com/.../banner1.webp",
      "title": "Diwali Mega Sale",
      "link_url": "https://autodeal4u.com/sale",
      "order": 0,
      "is_active": true
    }
  ]
}
```

#### `POST /api/v1/admin/banners`
Creates a promotional banner with file upload.
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `image` *(File, required)*: JPEG, PNG, or WEBP.
  - `title` *(string, optional)*
  - `link_url` *(string, optional URL)*
  - `order` *(integer >= 0, optional)*
  - `is_active` *(boolean, optional, default `true`)*

#### `PUT /api/v1/admin/banners/:id`
Updates banner metadata and optionally replaces the image.
- **Content-Type:** `multipart/form-data`
- **Fields:** `image` *(File, optional)*, `title`, `link_url`, `order`, `is_active`.

#### `POST /api/v1/admin/banners/reorder`
Reorders multiple banners in bulk for slider ordering.
- **Content-Type:** `application/json`
```json
{
  "orders": [
    { "id": "banner-uuid-1", "order": 0 },
    { "id": "banner-uuid-2", "order": 1 }
  ]
}
```

#### `DELETE /api/v1/admin/banners/:id`
Deletes the banner from the database and Cloudinary.

---

### 3.9 Vehicle Highlights Tags

Highlights are feature tags (e.g., `"Sunroof"`, `"Single Owner"`, `"Non-Accidental"`) used to tag car listings.

#### `GET /api/v1/admin/highlights`
Returns all highlight tags.

#### `POST /api/v1/admin/highlights`
**Request Body (`application/json`):**
```json
{
  "name": "360 Degree Camera",
  "is_active": true
}
```

#### `PUT /api/v1/admin/highlights/:id`
Updates name or active status.
```json
{
  "name": "360 Panoramic Camera",
  "is_active": true
}
```

#### `PATCH /api/v1/admin/highlights/:id`
Quick boolean status toggle (whitelist: only `is_active` allowed).
```json
{
  "is_active": false
}
```

#### `DELETE /api/v1/admin/highlights/:id`
Removes highlight tag.

---

### 3.10 Catalog Management

#### `POST /api/v1/catalog/brands`
Adds a new brand with a brand logo image.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `name` *(string, required)*
  - `logo` *(File, required)*: Image file (JPEG, PNG, SVG, WEBP)

#### `POST /api/v1/catalog/sync`
Triggers full synchronization of vehicle catalog (brands, models, variants) against master external catalog datasets.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response `200 OK`:**
```json
{
  "status": "success",
  "message": "Vehicle catalog synchronization completed successfully.",
  "data": {
    "brandsAdded": 2,
    "modelsAdded": 14,
    "variantsAdded": 52
  }
}
```

---

### 3.11 Subscriptions & Payments Overview (Read-Only)

#### `GET /api/v1/admin/subscriptions`
Lists all seller subscription records.

#### `GET /api/v1/admin/payments`
Lists successful payments (`payment_id`, `amount_paid`, `created_at`, `seller_id`).

---

## 4. Frontend Integration Guide & Code Samples

### 4.1 Axios Client Configuration
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject Admin JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor for handling global auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      alert('Access Denied: Admin privileges required.');
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 4.2 Helper API Service Methods
```javascript
import api from './api';

// Traffic Stats
export const fetchTrafficStats = () => api.get('/admin/traffic');

// User Approval Flow
export const fetchPendingUsersCount = () => api.get('/admin/users/pending/count');
export const fetchPendingUsers = (params) => api.get('/admin/users/pending', { params });
export const approveUser = (id) => api.patch(`/admin/users/${id}/approve`);
export const rejectUser = (id, reason) => api.patch(`/admin/users/${id}/reject`, { reason });

// Dealer Management
export const fetchDealers = (params) => api.get('/admin/dealers', { params });
export const fetchDealerById = (id) => api.get(`/admin/dealers/${id}`);
export const fetchDealerCars = (dealerId) => api.get(`/admin/dealers/${dealerId}/cars`);

// Enquiries
export const fetchAllEnquiries = (params) => api.get('/admin/enquiries', { params });

// Car Reports
export const fetchCarReports = (params) => api.get('/admin/car-reports', { params });
export const updateReportStatus = (id, data) => api.patch(`/admin/car-reports/${id}`, data);

// Banners (Multipart File Upload)
export const createBanner = (formData) =>
  api.post('/admin/banners', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateBanner = (id, formData) =>
  api.put(`/admin/banners/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const reorderBanners = (orders) => api.post('/admin/banners/reorder', { orders });
export const deleteBanner = (id) => api.delete(`/admin/banners/${id}`);

// Highlights
export const fetchHighlights = () => api.get('/admin/highlights');
export const createHighlight = (data) => api.post('/admin/highlights', data);
export const toggleHighlight = (id, is_active) => api.patch(`/admin/highlights/${id}`, { is_active });
export const deleteHighlight = (id) => api.delete(`/admin/highlights/${id}`);
```
