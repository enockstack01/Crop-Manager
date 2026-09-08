import createHttpError from './httpError.js';
import { asyncHandler } from './asyncHandler.js';
import { buildQuery } from './queryBuilder.js';
import { toPopulate, reshapeMany, reshape } from './shape.js';
import { serialize } from './serialize.js';

/**
 * Build a set of REST handlers for one resource from its declarative config
 * (see resources.js). Every query is scoped to the authenticated user.
 */
export function crudController(resource) {
  const Model = resource.model;
  const populate = toPopulate(resource.relations || []);

  const readOne = async (id, userId) => {
    let query = Model.findOne({ _id: id, user_id: userId });
    if (populate.length) query = query.populate(populate);
    const doc = await query.lean();
    if (!doc) throw createHttpError(404, `${resource.name} not found`);
    return reshape(serialize(doc), resource.relations || []);
  };

  return {
    list: asyncHandler(async (req, res) => {
      const { filter, sort, page, perPage, skip, limit } = buildQuery(req.query, resource, req.userId);
      let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
      if (populate.length) query = query.populate(populate);
      const [rows, total] = await Promise.all([
        query.lean(),
        Model.countDocuments(filter),
      ]);
      res.json({
        data: reshapeMany(serialize(rows), resource.relations || []),
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      });
    }),

    getOne: asyncHandler(async (req, res) => {
      res.json(await readOne(req.params.id, req.userId));
    }),

    create: asyncHandler(async (req, res) => {
      const body = stripReadOnly(req.body);
      const doc = new Model({ ...body, user_id: req.userId });
      await doc.save();
      res.status(201).json(await readOne(doc._id, req.userId));
    }),

    update: asyncHandler(async (req, res) => {
      const doc = await Model.findOne({ _id: req.params.id, user_id: req.userId });
      if (!doc) throw createHttpError(404, `${resource.name} not found`);
      const body = stripReadOnly(req.body);
      doc.set(body);
      await doc.save();
      res.json(await readOne(doc._id, req.userId));
    }),

    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
      if (!doc) throw createHttpError(404, `${resource.name} not found`);
      res.json({ id: req.params.id, deleted: true });
    }),

    readOne,
  };
}

function stripReadOnly(body = {}) {
  const clone = { ...body };
  for (const k of ['_id', 'id', 'user_id', 'created_at', 'updated_at', '__v']) delete clone[k];
  return clone;
}
