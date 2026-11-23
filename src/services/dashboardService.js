const { Car, Lead, Requirement, CommercialVehicle } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const redisClient = require('../config/redis');

const CACHE_TTL = 60; // seconds
const CACHE_KEY_PREFIX = 'dashboard:user:';

/**
 * Get dashboard summary metrics for an authenticated user (customer or dealer)
 * @param {string} userId
 * @param {string} role ('customer' | 'dealer' | 'admin')
 * @returns {Promise<Object>}
 */
exports.getDashboardSummary = async (userId, role, options = {}) => {
  const requestedCategory = (options.category || options.target_type || options.type || '').trim().toLowerCase();
  const requestedRole = (options.role || '').trim().toLowerCase();
  const cacheKey = `${CACHE_KEY_PREFIX}${userId}:${requestedCategory || 'all'}:${requestedRole || 'all'}`;

  // 1. Read from Redis Cache if available
  if (redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis cache get error in getDashboardSummary:', err);
    }
  }

  // 2. Leads ownership mapping: Dashboard counts leads received on user's vehicle listings (seller_id)
  const leadWhere = { seller_id: userId };

  // 3. Dynamic Expiry: Auto-expire active requirements past expiry date before counting
  try {
    await Requirement.update(
      { status: 'expired' },
      {
        where: {
          user_id: userId,
          status: 'active',
          expiry_date: { [Op.lt]: new Date() },
        },
      }
    );
  } catch (expErr) {
    console.error('Requirement auto-expiry error in getDashboardSummary:', expErr);
  }

  // 4. Parallel aggregated COUNT queries with GROUP BY
  const [
    carCounts,
    commercialCounts,
    sellerLeadCounts,
    buyerEnquiryCounts,
    requirementCounts,
    sellerLeadsWithVehicleStatus,
    buyerEnquiriesWithVehicleStatus,
  ] = await Promise.all([
    // Cars by status (unscoped to correctly capture active, sold, and deleted statuses)
    Car.unscoped().findAll({
      where: { user_id: userId },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
    // Commercial vehicles by status
    CommercialVehicle.findAll({
      where: { user_id: userId },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
    // Seller Leads received by source and target_type
    Lead.findAll({
      where: leadWhere,
      attributes: ['source', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source', 'target_type'],
      raw: true,
    }),
    // Buyer Enquiries sent by source and target_type
    Lead.findAll({
      where: { buyer_id: userId },
      attributes: ['source', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['source', 'target_type'],
      raw: true,
    }),
    // Requirements by status and target_type
    Requirement.findAll({
      where: { user_id: userId },
      attributes: ['status', 'target_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status', 'target_type'],
      raw: true,
    }),
    // Seller Leads with vehicle status to compute active_inventory vs deleted_inventory
    Lead.findAll({
      where: leadWhere,
      attributes: ['id', 'source', 'target_type', 'target_id', 'car_id'],
      include: [
        {
          model: Car.unscoped(),
          as: 'car',
          attributes: ['id', 'status', 'deleted_at'],
          required: false,
        },
        {
          model: CommercialVehicle.unscoped ? CommercialVehicle.unscoped() : CommercialVehicle,
          as: 'commercialVehicle',
          attributes: ['id', 'status', 'deleted_at'],
          required: false,
        },
      ],
      raw: false,
    }),
    // Buyer Enquiries with vehicle status to compute active_inventory vs deleted_inventory
    Lead.findAll({
      where: { buyer_id: userId },
      attributes: ['id', 'source', 'target_type', 'target_id', 'car_id'],
      include: [
        {
          model: Car.unscoped(),
          as: 'car',
          attributes: ['id', 'status', 'deleted_at'],
          required: false,
        },
        {
          model: CommercialVehicle.unscoped ? CommercialVehicle.unscoped() : CommercialVehicle,
          as: 'commercialVehicle',
          attributes: ['id', 'status', 'deleted_at'],
          required: false,
        },
      ],
      raw: false,
    }),
  ]);

  // 5. Build clean, role-separated entities
  const sellerInventory = {
    cars: {
      total: 0,
      active: 0,
      sold: 0,
      deleted: 0,
      expired: 0,
    },
    commercial: {
      total: 0,
      active: 0,
      sold: 0,
      deleted: 0,
      expired: 0,
    },
    vehicles: {
      total: 0,
      active: 0,
      sold: 0,
      deleted: 0,
      expired: 0,
    },
  };

  const sellerLeadsReceived = {
    total: 0,
    active_inventory: 0,
    deleted_inventory: 0,
    by_source: {
      whatsapp: 0,
      call: 0,
      message: 0,
    },
    by_target: {
      car: 0,
      commercial: 0,
    },
  };

  const buyerRequirements = {
    total: 0,
    active: 0,
    expired: 0,
    bought: 0,
    deleted: 0,
    by_target: {
      car: 0,
      commercial: 0,
    },
  };

  const buyerEnquiriesSent = {
    total: 0,
    active_inventory: 0,
    deleted_inventory: 0,
    by_source: {
      whatsapp: 0,
      call: 0,
      message: 0,
    },
    by_target: {
      car: 0,
      commercial: 0,
    },
  };

  // 5b. Build Category-Specific Breakdowns (for Cars vs Commercial tabs)
  const carCategory = {
    seller: {
      inventory: sellerInventory.cars,
      leads_received: {
        total: 0,
        active_inventory: 0,
        deleted_inventory: 0,
        by_source: {
          whatsapp: 0,
          call: 0,
          message: 0,
        },
      },
    },
    buyer: {
      requirements: {
        total: 0,
        active: 0,
        expired: 0,
        bought: 0,
        deleted: 0,
      },
      enquiries_sent: {
        total: 0,
        active_inventory: 0,
        deleted_inventory: 0,
        by_source: {
          whatsapp: 0,
          call: 0,
          message: 0,
        },
      },
    },
  };

  const commercialCategory = {
    seller: {
      inventory: sellerInventory.commercial,
      leads_received: {
        total: 0,
        active_inventory: 0,
        deleted_inventory: 0,
        by_source: {
          whatsapp: 0,
          call: 0,
          message: 0,
        },
      },
    },
    buyer: {
      requirements: {
        total: 0,
        active: 0,
        expired: 0,
        bought: 0,
        deleted: 0,
      },
      enquiries_sent: {
        total: 0,
        active_inventory: 0,
        deleted_inventory: 0,
        by_source: {
          whatsapp: 0,
          call: 0,
          message: 0,
        },
      },
    },
  };

  // 6. Populate Car Counts (Total excludes soft-deleted records)
  carCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      sellerInventory.cars.active = count;
      sellerInventory.cars.total += count;
    } else if (status === 'sold') {
      sellerInventory.cars.sold = count;
      sellerInventory.cars.total += count;
    } else if (status === 'expired') {
      sellerInventory.cars.expired = count;
      sellerInventory.cars.total += count;
    } else if (status === 'deleted') {
      sellerInventory.cars.deleted = count;
    } else {
      sellerInventory.cars.total += count;
    }
  });

  // 7. Populate Commercial Vehicle Counts (Total excludes soft-deleted records)
  commercialCounts.forEach((row) => {
    const status = row.status;
    const count = parseInt(row.count, 10) || 0;
    if (status === 'active') {
      sellerInventory.commercial.active = count;
      sellerInventory.commercial.total += count;
    } else if (status === 'sold') {
      sellerInventory.commercial.sold = count;
      sellerInventory.commercial.total += count;
    } else if (status === 'expired') {
      sellerInventory.commercial.expired = count;
      sellerInventory.commercial.total += count;
    } else if (status === 'deleted') {
      sellerInventory.commercial.deleted = count;
    } else {
      sellerInventory.commercial.total += count;
    }
  });

  // 8. Populate Unified Vehicles Object (sums up statuses across both sources)
  sellerInventory.vehicles.active = sellerInventory.cars.active + sellerInventory.commercial.active;
  sellerInventory.vehicles.sold = sellerInventory.cars.sold + sellerInventory.commercial.sold;
  sellerInventory.vehicles.deleted = sellerInventory.cars.deleted + sellerInventory.commercial.deleted;
  sellerInventory.vehicles.expired = (sellerInventory.cars.expired || 0) + sellerInventory.commercial.expired;
  sellerInventory.vehicles.total = sellerInventory.cars.total + sellerInventory.commercial.total;

  // 9. Populate Seller Lead Counts (leads received by seller on their listings)
  sellerLeadCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    sellerLeadsReceived.total += count;

    if (sellerLeadsReceived.by_source[source] !== undefined) {
      sellerLeadsReceived.by_source[source] += count;
    } else {
      sellerLeadsReceived.by_source[source] = count;
    }

    if (targetType === 'commercial') {
      sellerLeadsReceived.by_target.commercial += count;
      commercialCategory.seller.leads_received.total += count;
      if (commercialCategory.seller.leads_received.by_source[source] !== undefined) {
        commercialCategory.seller.leads_received.by_source[source] += count;
      } else {
        commercialCategory.seller.leads_received.by_source[source] = count;
      }
    } else {
      sellerLeadsReceived.by_target.car += count;
      carCategory.seller.leads_received.total += count;
      if (carCategory.seller.leads_received.by_source[source] !== undefined) {
        carCategory.seller.leads_received.by_source[source] += count;
      } else {
        carCategory.seller.leads_received.by_source[source] = count;
      }
    }
  });

  // 9b. Populate Active vs Deleted Inventory Breakdown for Seller Leads
  if (Array.isArray(sellerLeadsWithVehicleStatus)) {
    sellerLeadsWithVehicleStatus.forEach((l) => {
      const isCommercial = (l.target_type || '').toLowerCase() === 'commercial';
      const veh = isCommercial ? l.commercialVehicle : (l.car || l.commercialVehicle);
      const isDeleted = !veh || veh.status === 'deleted' || veh.deleted_at !== null;
      if (isDeleted) {
        sellerLeadsReceived.deleted_inventory++;
        if (isCommercial) {
          commercialCategory.seller.leads_received.deleted_inventory++;
        } else {
          carCategory.seller.leads_received.deleted_inventory++;
        }
      } else {
        sellerLeadsReceived.active_inventory++;
        if (isCommercial) {
          commercialCategory.seller.leads_received.active_inventory++;
        } else {
          carCategory.seller.leads_received.active_inventory++;
        }
      }
    });
  }

  // 10. Populate Buyer Enquiry Counts (enquiries sent by user to other sellers)
  buyerEnquiryCounts.forEach((row) => {
    const source = (row.source || 'message').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    buyerEnquiriesSent.total += count;

    if (buyerEnquiriesSent.by_source[source] !== undefined) {
      buyerEnquiriesSent.by_source[source] += count;
    } else {
      buyerEnquiriesSent.by_source[source] = count;
    }

    if (targetType === 'commercial') {
      buyerEnquiriesSent.by_target.commercial += count;
      commercialCategory.buyer.enquiries_sent.total += count;
      if (commercialCategory.buyer.enquiries_sent.by_source[source] !== undefined) {
        commercialCategory.buyer.enquiries_sent.by_source[source] += count;
      } else {
        commercialCategory.buyer.enquiries_sent.by_source[source] = count;
      }
    } else {
      buyerEnquiriesSent.by_target.car += count;
      carCategory.buyer.enquiries_sent.total += count;
      if (carCategory.buyer.enquiries_sent.by_source[source] !== undefined) {
        carCategory.buyer.enquiries_sent.by_source[source] += count;
      } else {
        carCategory.buyer.enquiries_sent.by_source[source] = count;
      }
    }
  });

  // 10b. Populate Active vs Deleted Inventory Breakdown for Buyer Enquiries
  if (Array.isArray(buyerEnquiriesWithVehicleStatus)) {
    buyerEnquiriesWithVehicleStatus.forEach((l) => {
      const isCommercial = (l.target_type || '').toLowerCase() === 'commercial';
      const veh = isCommercial ? l.commercialVehicle : (l.car || l.commercialVehicle);
      const isDeleted = !veh || veh.status === 'deleted' || veh.deleted_at !== null;
      if (isDeleted) {
        buyerEnquiriesSent.deleted_inventory++;
        if (isCommercial) {
          commercialCategory.buyer.enquiries_sent.deleted_inventory++;
        } else {
          carCategory.buyer.enquiries_sent.deleted_inventory++;
        }
      } else {
        buyerEnquiriesSent.active_inventory++;
        if (isCommercial) {
          commercialCategory.buyer.enquiries_sent.active_inventory++;
        } else {
          carCategory.buyer.enquiries_sent.active_inventory++;
        }
      }
    });
  }

  // 11. Populate Requirement Counts (buying requirements posted by user)
  requirementCounts.forEach((row) => {
    const status = (row.status || 'active').trim().toLowerCase();
    const targetType = (row.target_type || 'car').trim().toLowerCase();
    const count = parseInt(row.count, 10) || 0;

    const isCommercial = targetType === 'commercial';
    const catReq = isCommercial ? commercialCategory.buyer.requirements : carCategory.buyer.requirements;

    if (status === 'active') {
      buyerRequirements.active += count;
      buyerRequirements.total += count;
      catReq.active += count;
      catReq.total += count;
    } else if (status === 'expired') {
      buyerRequirements.expired += count;
      buyerRequirements.total += count;
      catReq.expired += count;
      catReq.total += count;
    } else if (status === 'bought') {
      buyerRequirements.bought += count;
      buyerRequirements.total += count;
      catReq.bought += count;
      catReq.total += count;
    } else if (status === 'deleted') {
      buyerRequirements.deleted += count;
      catReq.deleted += count;
    }

    if (isCommercial) {
      buyerRequirements.by_target.commercial += count;
    } else {
      buyerRequirements.by_target.car += count;
    }
  });

  // 12. Final Master Result
  const masterResult = {
    // ──────── CATEGORY-FIRST BREAKDOWN (For Tabs / Category Switchers) ────────
    categories: {
      car: carCategory,
      commercial: commercialCategory,
    },

    // ──────── ROLE-FIRST BREAKDOWN ────────
    seller: {
      inventory: sellerInventory,
      leads_received: sellerLeadsReceived,
    },

    buyer: {
      requirements: buyerRequirements,
      enquiries_sent: buyerEnquiriesSent,
    },

    // ──────── BACKWARD COMPATIBILITY (Existing Screens) ────────
    cars: sellerInventory.cars,
    commercial: sellerInventory.commercial,
    vehicles: sellerInventory.vehicles,
    leads: sellerLeadsReceived,
    requirements: buyerRequirements,
  };

  // 13. Determine Response Shape Based on Query Options
  let responsePayload = masterResult;

  if (requestedCategory === 'car') {
    if (requestedRole === 'seller') {
      responsePayload = {
        category: 'car',
        role: 'seller',
        inventory: carCategory.seller.inventory,
        leads_received: carCategory.seller.leads_received,
      };
    } else if (requestedRole === 'buyer') {
      responsePayload = {
        category: 'car',
        role: 'buyer',
        requirements: carCategory.buyer.requirements,
        enquiries_sent: carCategory.buyer.enquiries_sent,
      };
    } else {
      responsePayload = {
        category: 'car',
        seller: carCategory.seller,
        buyer: carCategory.buyer,
        inventory: carCategory.seller.inventory,
        leads_received: carCategory.seller.leads_received,
        requirements: carCategory.buyer.requirements,
        enquiries_sent: carCategory.buyer.enquiries_sent,
      };
    }
  } else if (requestedCategory === 'commercial') {
    if (requestedRole === 'seller') {
      responsePayload = {
        category: 'commercial',
        role: 'seller',
        inventory: commercialCategory.seller.inventory,
        leads_received: commercialCategory.seller.leads_received,
      };
    } else if (requestedRole === 'buyer') {
      responsePayload = {
        category: 'commercial',
        role: 'buyer',
        requirements: commercialCategory.buyer.requirements,
        enquiries_sent: commercialCategory.buyer.enquiries_sent,
      };
    } else {
      responsePayload = {
        category: 'commercial',
        seller: commercialCategory.seller,
        buyer: commercialCategory.buyer,
        inventory: commercialCategory.seller.inventory,
        leads_received: commercialCategory.seller.leads_received,
        requirements: commercialCategory.buyer.requirements,
        enquiries_sent: commercialCategory.buyer.enquiries_sent,
      };
    }
  } else if (requestedRole === 'seller') {
    responsePayload = {
      role: 'seller',
      ...masterResult.seller,
      by_category: {
        car: carCategory.seller,
        commercial: commercialCategory.seller,
      },
    };
  } else if (requestedRole === 'buyer') {
    responsePayload = {
      role: 'buyer',
      ...masterResult.buyer,
      by_category: {
        car: carCategory.buyer,
        commercial: commercialCategory.buyer,
      },
    };
  }

  // 14. Cache in Redis
  if (redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(responsePayload));
    } catch (err) {
      console.error('Redis cache set error in getDashboardSummary:', err);
    }
  }

  return responsePayload;
};

/**
 * Invalidate dashboard cache for a user
 * @param {string} userId
 */
exports.invalidateDashboardCache = async (userId) => {
  if (!userId) return;
  try {
    if (redisClient.isOpen) {
      // Clear all cached variants (all, car, commercial, seller, buyer)
      const keys = await redisClient.keys(`${CACHE_KEY_PREFIX}${userId}*`);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (err) {
    console.error('Redis invalidate error in invalidateDashboardCache:', err);
  }
};
