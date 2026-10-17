import mongoose from 'mongoose';

/*
 * Organizations and farmer referrals (Logistack specification v1.0, 17 October 2026).
 * Farmers keep owning their records (every farm collection is keyed by the farmer's Clerk user_id);
 * an organization reaches them only through an active farmer_organizations row.
 */
const { Schema } = mongoose;
const json = {
  versionKey: false,
  transform: (_d, r) => { r.id = r._id?.toString(); delete r._id; return r; },
};
const base = (definition, extra = {}) =>
  new Schema(definition, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, toJSON: json, toObject: json, ...extra });

export const ORG_TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];
export const ORG_STATUSES = ['pending', 'active', 'suspended'];

const OrganizationSchema = base({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  name_key: { type: String, required: true, unique: true }, // lower-case name: names are unique ignoring case
  type: { type: String, enum: ORG_TYPES, default: 'Other' },
  country: { type: String, trim: true },
  district: { type: String, trim: true },
  sector: { type: String, trim: true },
  contact_email: { type: String, trim: true },
  contact_phone: { type: String, trim: true },
  status: { type: String, enum: ORG_STATUSES, default: 'pending', index: true },
  max_farmers: { type: Number, default: 100, min: 0 }, // set by the system administrator only
  farmer_count: { type: Number, default: 0, min: 0 }, // active farmers, changed only by atomic increments
  notified_80: { type: Boolean, default: false },
  notified_100: { type: Boolean, default: false },
  created_by: { type: String, default: null },
  approved_by: { type: String, default: null },
  approved_at: { type: Date, default: null },
  suspended_reason: { type: String, default: '' },
});

const OrganizationMemberSchema = base({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  user_id: { type: String, default: null, index: true }, // Clerk user id; null while only invited by email
  invited_email: { type: String, trim: true, lowercase: true, default: null },
  role: { type: String, enum: ['org_admin', 'org_staff'], required: true },
  status: { type: String, enum: ['invited', 'active', 'removed'], default: 'invited' },
});
OrganizationMemberSchema.index({ organization_id: 1, user_id: 1 });

const ReferralLinkSchema = base({
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  token_hash: { type: String, required: true, unique: true }, // SHA-256 of the token; the token itself is never stored
  label: { type: String, trim: true, maxlength: 80, default: '' },
  created_by: { type: String, required: true },
  expires_at: { type: Date, required: true },
  max_uses: { type: Number, default: null, min: 1 },
  use_count: { type: Number, default: 0 },
  revoked_at: { type: Date, default: null },
});

const FarmerOrganizationSchema = base({
  farmer_id: { type: String, required: true }, // Clerk user id of the farmer
  organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  referral_link_id: { type: Schema.Types.ObjectId, ref: 'ReferralLink', default: null },
  status: { type: String, enum: ['active', 'left', 'removed'], default: 'active' },
  consent_given_at: { type: Date, required: true },
  consent_source: { type: String, enum: ['farmer', 'bulk_import'], default: 'farmer' },
  joined_at: { type: Date, default: Date.now },
  ended_at: { type: Date, default: null },
  ended_by: { type: String, default: null },
  end_reason: { type: String, default: '' },
});
// a farmer belongs to at most one organization at a time
FarmerOrganizationSchema.index({ farmer_id: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
FarmerOrganizationSchema.index({ organization_id: 1, status: 1 });

const AuditLogSchema = new Schema(
  {
    actor_id: { type: String, default: null },
    actor_name: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    target_type: { type: String, default: '' },
    target_id: { type: String, default: '' },
    organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    user_agent: { type: String, default: '' },
    created_at: { type: Date, default: Date.now, index: true },
  },
  { toJSON: json, toObject: json }
);

export const Organization = mongoose.model('Organization', OrganizationSchema);
export const OrganizationMember = mongoose.model('OrganizationMember', OrganizationMemberSchema);
export const ReferralLink = mongoose.model('ReferralLink', ReferralLinkSchema);
export const FarmerOrganization = mongoose.model('FarmerOrganization', FarmerOrganizationSchema);
export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
