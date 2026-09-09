// Enumerations — identical to client/src/lib/options.js

export const AREA_UNITS = ['hectares', 'acres', 'square metres'];
export const WEIGHT_UNITS = ['kg', 'tonnes', 'bags', 'litres'];
export const SPACING_UNITS = ['cm', 'metres', 'inches'];

export const FARM_TYPES = ['Crop', 'Mixed', 'Organic', 'Irrigated', 'Rainfed'];
export const FIELD_STATUS = ['Active', 'Fallow', 'Preparing', 'Maintenance'];
export const SEASON_STATUS = ['Active', 'Planned', 'Completed', 'Archived'];
export const GROWING_PERIOD_UNITS = ['days', 'weeks', 'months'];

export const CYCLE_STATUS = [
  'Planned', 'Planted', 'Growing', 'Ready for Harvest', 'Harvested', 'Completed', 'Cancelled',
];

export const ACTIVITY_TYPES = [
  'Land Preparation', 'Ploughing', 'Harrowing', 'Planting', 'Weeding', 'Fertilization',
  'Irrigation', 'Spraying', 'Scouting', 'Harvest', 'Transport', 'Machinery', 'Other',
];

export const IRRIGATION_METHODS = ['Drip', 'Sprinkler', 'Furrow', 'Basin', 'Flood', 'Center Pivot', 'Other'];
export const WATER_UNITS = ['cubic metres', 'litres', 'mm'];

export const FERTILIZER_TYPES = ['NPK', 'Urea', 'DAP', 'CAN', 'MOP', 'TSP', 'Organic', 'Foliar', 'Lime', 'Other'];
export const FERTILIZER_METHODS = [
  'Broadcasting', 'Band Placement', 'Fertigation', 'Foliar Spray', 'Top Dressing', 'Basal', 'Other',
];

export const PROBLEM_TYPES = ['Pest', 'Disease', 'Weed', 'Other'];
export const SEVERITIES = ['Low', 'Moderate', 'High', 'Critical'];
export const PROTECTION_METHODS = [
  'Spraying', 'Dusting', 'Seed Treatment', 'Soil Treatment', 'Biological Control', 'Other',
];

export const PLANT_HEALTH = ['Healthy', 'Under Observation', 'At Risk'];
export const HARVEST_QUALITY = ['Excellent', 'Good', 'Average', 'Poor', 'Rejected'];

export const INVENTORY_CATEGORIES = [
  'Seeds', 'Fertilizers', 'Pesticides', 'Tools', 'Equipment', 'Packaging', 'Other',
];
export const INVENTORY_UNITS = ['kg', 'bags', 'litres', 'tonnes', 'units', 'packets'];
export const INVENTORY_STATUS = ['In Stock', 'Low Stock', 'Out of Stock'];

export const EQUIPMENT_STATUS = ['Available', 'In Use', 'Maintenance', 'Damaged', 'Retired'];

export const EXPENSE_CATEGORIES = [
  'Seeds', 'Fertilizer', 'Pesticides', 'Labor', 'Irrigation', 'Machinery', 'Fuel',
  'Transport', 'Storage', 'Equipment', 'Other',
];

export const PAYMENT_STATUS = ['Pending', 'Partially Paid', 'Paid'];

export const USER_ROLES = ['Farmer', 'Farm Manager', 'Agronomist', 'Cooperative Manager', 'Administrator'];
