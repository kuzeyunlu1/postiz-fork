#!/usr/bin/env node
/**
 * Automatically adds @@schema("postiz") to all Prisma models
 * that don't already have it. Also ensures datasource has schemas
 * config and generator has multiSchema preview feature.
 *
 * Used for upstream merge conflict resolution — run after merging
 * upstream changes to re-apply schema annotations to new models.
 *
 * Usage: node eoma-patches/add-schema-annotations.js
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(
  __dirname,
  '..',
  'libraries',
  'nestjs-libraries',
  'src',
  'database',
  'prisma',
  'schema.prisma'
);

let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Ensure datasource has schemas = ["postiz"]
if (!schema.includes('schemas')) {
  schema = schema.replace(
    /(datasource\s+db\s*\{[^}]*?)(url\s*=\s*env\("DATABASE_URL"\))/,
    '$1$2\n  schemas  = ["postiz"]'
  );
  console.log('Added schemas = ["postiz"] to datasource block');
}

// 2. Ensure generator has multiSchema preview feature
if (!schema.includes('multiSchema')) {
  if (schema.includes('previewFeatures')) {
    schema = schema.replace(
      /previewFeatures\s*=\s*\[([^\]]*)\]/,
      (match, features) => {
        const trimmed = features.trim();
        if (trimmed) {
          return `previewFeatures = [${trimmed}, "multiSchema"]`;
        }
        return `previewFeatures = ["multiSchema"]`;
      }
    );
  } else {
    schema = schema.replace(
      /(generator\s+client\s*\{[^}]*?)(runtime\s*=\s*"nodejs")/,
      '$1$2\n  previewFeatures = ["multiSchema"]'
    );
  }
  console.log('Added multiSchema to generator previewFeatures');
}

// 3. Add @@schema("postiz") to every model that doesn't have it
// NOTE: The non-greedy [\s\S]*? regex below matches the shortest stretch to the
// next closing "\n}". This works for current Prisma models (flat field lists) but
// would need updating if nested brace patterns (e.g. composite types) are introduced.
let modelsAnnotated = 0;
schema = schema.replace(
  /^(model\s+(\w+)\s*\{[\s\S]*?)(\n\})/gm,
  (match, body, modelName, closing) => {
    if (body.includes('@@schema')) return match;
    modelsAnnotated++;
    // Insert before the closing brace, after last field/attribute
    return `${body}\n\n  @@schema("postiz")${closing}`;
  }
);

// 4. Add @@schema("postiz") to every enum that doesn't have it
let enumsAnnotated = 0;
schema = schema.replace(
  /^(enum\s+(\w+)\s*\{[\s\S]*?)(\n\})/gm,
  (match, body, enumName, closing) => {
    if (body.includes('@@schema')) return match;
    enumsAnnotated++;
    return `${body}\n\n  @@schema("postiz")${closing}`;
  }
);

fs.writeFileSync(schemaPath, schema);
console.log(`Done. Annotated ${modelsAnnotated} models and ${enumsAnnotated} enums.`);
