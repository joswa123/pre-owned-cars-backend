# Polymorphic API Specification: Reports & Enquiries (Leads)

> **Version:** 1.1.0  
> **Target Audience:** Frontend Web & Mobile (Flutter/React/Next.js) Engineers, Admin Portal Engineers  
> **Base URL:** `/api/v1` (with `/api` fallback aliases)  
> **Auth:** JWT Bearer Token (`Authorization: Bearer <token>`)

---

## 1. Overview & Architectural Principles

Both the **Reports** and **Enquiries (Leads)** systems now feature full **polymorphic support** for both regular **Cars** and **Commercial Vehicles**:

1. **Polymorphic Fields:**
   - `target_type`: `'car'` | `'commercial'` (default: `'car'`)
   - `target_id`: UUID of the Car or Commercial Vehicle
   - `car_id`: Legacy UUID field retained for backward compatibility
2. **Unified & Backward-Compatible Response Contracts:**
   - **`car` object:** Always present in the response. If the listing is a car, it contains the car data. If the listing is a commercial vehicle, it is `null`.
   - **`commercial` / `commercialVehicle` object:** Populated with commercial vehicle attributes when `target_type === 'commercial'`.
   - **`vehicle` object:** A unified metadata object containing common attributes (`id`, `target_type`, `name`, `brand`, `model`, `year`, `price`, `status`, `primary_image`) for simplified UI rendering.

---

## 2. Reports Module (`CarReport`)

### 2.1 Submit Listing Report
Submit a report against a car or commercial vehicle listing. Requires authentication (registered users only).

- **Method / Endpoint:** `POST /api/v1/car-reports` or `POST /api/v1/reports`
- **Auth:** Required (Customer, Dealer, or Admin)
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`

#### Request Body
```json
{
  "target_type": "commercial",
  "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "reason": "fraudulent_listing",
  "description": "Seller is asking for deposit upfront before inspection.",
  "reporter_name": "Ravi Kumar",
  "reporter_phone": "9876543210"
}
```
*(For regular cars, `car_id` is also accepted in place of `target_id`)*

#### Success Response (`201 Created`)
```json
{
  "status": "success",
  "success": true,
  "message": "Report submitted successfully. Our team will review this listing.",
  "data": {
    "report": {
      "id": "e0b8a36c-9218-47c3-98cf-192a9b3c4e12",
      "target_type": "commercial",
      "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "car_id": null,
      "dealer_id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
      "reporter_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "reporter_name": "Ravi Kumar",
      "reporter_phone": "9876543210",
      "reason": "fraudulent_listing",
      "description": "Seller is asking for deposit upfront before inspection.",
      "status": "pending",
      "created_at": "2026-11-17T04:00:00.000Z",
      "car": null,
      "commercialVehicle": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "year": 2021,
        "price": 1450000,
        "status": "active",
        "brand": { "id": "b1", "name": "Tata" },
        "vehicleType": { "id": "t1", "name": "Mini Truck" },
        "images": [
          { "id": "img1", "image_url": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg", "is_primary": true }
        ]
      },
      "dealer": {
        "id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
        "full_name": "City Auto Traders",
        "phone": "9841000000",
        "email": "cityauto@autodeal.com",
        "role": "dealer"
      }
    }
  }
}
```

---

### 2.2 Get Listing Reports (Admin)
Retrieve paginated reports with search and filter capabilities.

- **Method / Endpoint:** `GET /api/v1/admin/car-reports` or `GET /api/v1/car-reports`
- **Auth:** Admin Only
- **Query Parameters:**
  - `page` (number, default: `1`)
  - `limit` (number, default: `20`, max: `100`)
  - `status` (`'pending'` | `'in_review'` | `'resolved'` | `'dismissed'`)
  - `target_type` (`'car'` | `'commercial'`)
  - `target_id` (UUID - searches both `car_id` and `target_id`)
  - `car_id` (UUID - searches both `car_id` and `target_id`)
  - `dealer_id` (UUID)
  - `reason` (string)
  - `sortBy` (`'created_at'` | `'updated_at'` | `'status'`)
  - `sortOrder` (`'ASC'` | `'DESC'`)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "success": true,
  "data": {
    "reports": [
      {
        "id": "e0b8a36c-9218-47c3-98cf-192a9b3c4e12",
        "target_type": "commercial",
        "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "car_id": null,
        "reason": "fraudulent_listing",
        "status": "pending",
        "created_at": "2026-11-17T04:00:00.000Z",
        "car": null,
        "commercialVehicle": {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "year": 2021,
          "price": 1450000,
          "status": "active",
          "brand": { "id": "b1", "name": "Tata" },
          "vehicleType": { "id": "t1", "name": "Mini Truck" },
          "images": [
            { "id": "img1", "image_url": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg", "is_primary": true }
          ]
        },
        "dealer": {
          "id": "8b7a6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
          "full_name": "City Auto Traders",
          "phone": "9841000000",
          "email": "cityauto@autodeal.com",
          "role": "dealer",
          "city": "Chennai"
        },
        "reporter": {
          "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
          "full_name": "Ravi Kumar",
          "phone": "9876543210",
          "email": "ravi@gmail.com"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### 2.3 Get Report by ID (Admin)
- **Method / Endpoint:** `GET /api/v1/admin/car-reports/:id` or `GET /api/v1/car-reports/:id`
- **Auth:** Admin Only
- Returns detailed report with nested `car`, `commercialVehicle`, `dealer`, and `reporter`.

---

### 2.4 Update Report Status (Admin)
- **Method / Endpoint:** `PATCH /api/v1/admin/car-reports/:id` or `PATCH /api/v1/car-reports/:id`
- **Auth:** Admin Only
- **Request Body:**
```json
{
  "status": "resolved",
  "admin_notes": "Contacted seller and verified documents."
}
```

---

## 3. Enquiries / Leads Module (`Lead`)

### 3.1 Submit Enquiry / Lead
Submit an enquiry for a car or commercial vehicle listing.

- **Method / Endpoint:** `POST /api/v1/leads` or `POST /api/v1/enquiries`
- **Auth:** Required (Registered User or Guest with name & phone)
- **Request Body (Commercial Vehicle Example):**
```json
{
  "target_type": "commercial",
  "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "source": "whatsapp",
  "message": "Hi, I am interested in this vehicle. Is the price negotiable?",
  "contact_phone": "9876543210"
}
```
*(For cars: pass `"target_type": "car"`, `"target_id": "..."` or `"car_id": "..."`)*

#### Success Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Enquiry sent successfully",
  "data": {
    "id": "4e7a8b1c-3d2e-4f5a-9b8c-7d6e5f4a3b2c",
    "target_type": "commercial",
    "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "whatsapp",
    "status": "new",
    "is_viewed": false,
    "interacted_at": "2026-11-17T04:05:00.000Z",
    "created_at": "2026-11-17T04:05:00.000Z",
    "buyer": {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "full_name": "Ravi Kumar",
      "phone": "9876543210",
      "email": "ravi@gmail.com",
      "role": "customer"
    },
    "car": null,
    "commercial": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "brand": "Tata",
      "model": "Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg",
      "metrics": {
        "views": 42,
        "total_enquiries": 3
      }
    },
    "vehicle": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "brand": "Tata",
      "model": "Mini Truck",
      "year": 2021,
      "price": 1450000,
      "status": "active",
      "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg"
    }
  }
}
```

---

### 3.2 Seller Lead Summary (Aggregated Cars & Commercial Vehicles)
Returns summary cards for all vehicles owned by the seller with live metrics (leads count, breakdown by channel, views, wishlists).

- **Method / Endpoint:** `GET /api/v1/leads/summary` or `GET /api/v1/leads/seller/summary`
- **Auth:** Required (Seller / Dealer)
- **Query Parameters:**
  - `status` (`'active'` | `'sold'` | `'all'`)
  - `limit` (number, default: `20`)
  - `cursor` (string for cursor-based pagination)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "cars": [
      {
        "car_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "target_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "target_type": "commercial",
        "name": "Tata Mini Truck 2021",
        "price": 1450000,
        "number_plate": null,
        "status": "active",
        "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/truck.jpg",
        "total_lead_count": 5,
        "breakdown": {
          "calls": 2,
          "whatsapp": 2,
          "messages": 1,
          "enquiries": 0,
          "views": 42,
          "wishlist": 3
        },
        "created_at": "2026-11-17T03:00:00.000Z"
      },
      {
        "car_id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "target_id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "target_type": "car",
        "name": "Toyota Innova Crysta",
        "price": 2200000,
        "number_plate": "TN09AB1234",
        "status": "active",
        "primary_image": "https://res.cloudinary.com/demo/image/upload/v1/innova.jpg",
        "total_lead_count": 12,
        "breakdown": {
          "calls": 6,
          "whatsapp": 4,
          "messages": 2,
          "enquiries": 0,
          "views": 150,
          "wishlist": 18
        },
        "created_at": "2026-11-16T10:00:00.000Z"
      }
    ],
    "vehicles": [ /* identical array to cars for modern clients */ ],
    "pagination": {
      "limit": 20,
      "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0xMS0xNlQxMDowMDowMC4wMDBaIiwiaWQiOiI3YThiOSJ9",
      "has_more": false
    }
  }
}
```

---

### 3.3 Vehicle Leads Drill-Down Timeline
Fetch chronological enquiry timeline for a specific listing (dynamically resolves either a regular **Car** or a **Commercial Vehicle**).

- **Method / Endpoint:**
  - `GET /api/v1/leads/car/:carId`
  - `GET /api/v1/leads/commercial/:carId`
  - `GET /api/v1/leads/vehicle/:carId`
  *(All 3 endpoints route polymorphically)*
- **Auth:** Required (Must be vehicle owner)
- **Query Parameters:**
  - `source` (`'whatsapp'` | `'call'` | `'message'`)
  - `limit` (default: `20`)
  - `cursor` (cursor-based pagination)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "car_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "number_plate": null
    },
    "vehicle_info": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "target_type": "commercial",
      "name": "Tata Mini Truck 2021",
      "number_plate": null
    },
    "leads": [
      {
        "buyer_name": "Ravi Kumar",
        "buyer_phone": "9876543210",
        "interacted_at": "2026-11-17T04:05:00.000Z",
        "source": "whatsapp"
      }
    ],
    "pagination": {
      "limit": 20,
      "next_cursor": null,
      "has_more": false
    }
  }
}
```

---

### 3.4 Seller Leads Inbox
- **Method / Endpoint:** `GET /api/v1/leads/seller` or `GET /api/v1/leads/seller/leads`
- **Auth:** Required (Seller)
- **Query Parameters:** `status`, `target_type` (`'car'` | `'commercial'`), `page`, `limit`, `cursor`
- Returns unified paginated list of all enquiries received by the seller across both vehicle types.

---

### 3.5 Buyer Enquiries History
- **Method / Endpoint:** `GET /api/v1/leads/me`
- **Auth:** Required (Logged-in Buyer)
- Returns unified paginated list of all enquiries submitted by the current user across both vehicle types.
