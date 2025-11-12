# Database Migration Setup

## Overview

This service uses Drizzle ORM for database migrations. Migrations are automatically built into a Docker image and deployed as a Kubernetes Job before the application starts.

## Quick Start

### Local Development

Run migrations locally:

```bash
# Set database connection
export DB_URL="postgresql://user:password@localhost:5432/mastra_db"

# Run migrations
pnpm run migrate
```

### Production (Kubernetes)

Migrations are deployed as a Kubernetes Job. See the [Migration Deployment Guide](../eap-infra/k8s/base/jobs/MIGRATION_DEPLOYMENT_GUIDE.md) for detailed instructions.

Quick deployment:

```bash
# From eap-infra directory
cd eap-infra

# Delete old job
kubectl delete job evaluation-service-migration -n eap-platform --ignore-not-found=true

# Apply migration job
kubectl apply -f k8s/base/jobs/evaluation-service-migration-job.yaml

# Wait for completion
kubectl wait --for=condition=complete --timeout=300s job/evaluation-service-migration -n eap-platform

# Check logs
kubectl logs job/evaluation-service-migration -n eap-platform

# Deploy service
kubectl apply -f k8s/base/services/evaluation-service-deployment.yaml
```

## Creating New Migrations

1. **Update the schema** in `src/mastra/api/db/schema.ts`

   Example:
   ```typescript
   export const newTable = pgTable("new_table", {
     id: uuid("id").primaryKey().defaultRandom(),
     name: varchar("name", { length: 255 }).notNull(),
     createdAt: timestamp("created_at").defaultNow(),
   });
   ```

2. **Generate migration files**

   ```bash
   pnpm drizzle-kit generate
   ```

   This creates:
   - SQL migration file in `src/mastra/api/db/`
   - Snapshot in `src/mastra/api/db/meta/`
   - Updates `_journal.json`

3. **Review the generated SQL**

   Check the generated `.sql` file to ensure it's correct.

4. **Test locally**

   ```bash
   pnpm run migrate
   ```

5. **Commit and push**

   ```bash
   git add src/mastra/api/db/
   git commit -m "Add new migration for <feature>"
   git push
   ```

6. **CI/CD automatically builds migration image**

   The GitHub Actions pipeline will:
   - Build the migration Docker image
   - Push to GHCR with tags `main` and `<commit-sha>`

7. **Deploy to Kubernetes**

   Follow the [Migration Deployment Guide](../eap-infra/k8s/base/jobs/MIGRATION_DEPLOYMENT_GUIDE.md)

## Migration Files

```
src/mastra/api/db/
├── 0000_init_evaluation_history.sql      # Initial evaluation table
├── 0001_init_translation_history.sql     # Translation history table
├── schema.ts                              # Drizzle schema definition
├── index.ts                               # Database connection
└── meta/                                  # Migration metadata
    ├── 0000_snapshot.json
    ├── 0001_snapshot.json
    └── _journal.json
```

## Migration Script

The migration script (`scripts/migrate.ts`) features:

- ✅ Automatic connection retry (5 attempts, 3s delay)
- ✅ Support for both `DB_URL` and individual DB parameters
- ✅ Detailed logging with timestamps
- ✅ Proper exit codes (0 = success, 1 = failure)
- ✅ Connection cleanup
- ✅ Kubernetes-friendly error handling

## Docker Images

Two Docker images are built:

1. **Application Image**: `ghcr.io/graduation-project-ptit/eap-evaluation-service:main`
   - Contains the full application
   - Used by the Deployment

2. **Migration Image**: `ghcr.io/graduation-project-ptit/eap-evaluation-service-migrate:main`
   - Lightweight (~100-150MB)
   - Contains only migration dependencies
   - Used by the Job

## Environment Variables

### Required for Migrations

Primary (recommended):
- `DB_URL` - Full PostgreSQL connection string

Fallback:
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

### Optional
- `NODE_ENV` - Node environment (default: production)

## Troubleshooting

### Migration fails with "connection refused"

Check if PostgreSQL is running:
```bash
kubectl get pods -n eap-platform -l app=postgres
```

### Migration times out

Increase timeout in job manifest:
```yaml
spec:
  activeDeadlineSeconds: 600  # 10 minutes
```

### Check migration history

```bash
# Port-forward to database
kubectl port-forward svc/postgres 5432:5432 -n eap-platform

# Connect and query
psql postgresql://user:password@localhost:5432/mastra_db -c "SELECT * FROM __drizzle_migrations;"
```

## Best Practices

1. ✅ Always test migrations locally first
2. ✅ Review generated SQL before committing
3. ✅ Run migrations before deploying the application
4. ✅ Keep database backups before major migrations
5. ⚠️ Never edit migration files after they've been applied
6. ⚠️ Never delete migration files from the repository

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
- [Migration Deployment Guide](../eap-infra/k8s/base/jobs/MIGRATION_DEPLOYMENT_GUIDE.md)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

