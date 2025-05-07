.PHONY: dev-build dev-up dev-down dev-logs dev-migrate dev-head dev-base dev-upgrade dev-downgrade dev-recreate dev-db dev-redis
.PHONY: alembic-head alembic-base alembic-up alembic-down alembic-migrate alembic-recreate

# Get the pod name for the webserver
POD_NAME := $(shell kubectl get pods -l app=webserver -o jsonpath="{.items[0].metadata.name}")

# Common function to execute alembic commands in k8s
define exec_alembic
	@echo "Finding webserver pod..."
	@if [ -z "$(POD_NAME)" ]; then \
		echo "Error: No webserver pod found"; \
		exit 1; \
	fi
	@echo "Using pod: $(POD_NAME)"
	@kubectl exec $(POD_NAME) -- $(1)
endef

# Development environment commands
dev-build:
	@echo "Building development environment..."
	docker compose build

dev-up:
	@echo "Starting development environment..."
	docker compose up -d

dev-down:
	@echo "Stopping development environment..."
	docker compose down

dev-logs:
	@echo "Showing development logs..."
	docker compose logs -f

# Database migration commands for development
dev-migrate:
	@echo "Creating new migration..."
	docker compose exec webserver python -m alembic revision --autogenerate -m "$(filter-out $@,$(MAKECMDGOALS))"
	@echo "Applying migration..."
	docker compose exec webserver python -m alembic upgrade head
	@echo "Migration completed successfully!"

dev-head:
	@echo "Upgrading to latest version..."
	docker compose exec webserver python -m alembic upgrade head

dev-base:
	@echo "Downgrading to base version..."
	docker compose exec webserver python -m alembic downgrade base

dev-upgrade:
	@echo "Upgrading one version..."
	docker compose exec webserver python -m alembic upgrade +1

dev-downgrade:
	@echo "Downgrading one version..."
	docker compose exec webserver python -m alembic downgrade -1

dev-recreate:
	@echo "Recreating database schema..."
	docker compose exec webserver python -m alembic downgrade base
	docker compose exec webserver python -m alembic upgrade head

# Database access commands for development
dev-db:
	@echo "Connecting to development database..."
	docker compose exec mysql mysql -u webserver_dev_user -pdev_password webserver_dev_db

dev-redis:
	@echo "Connecting to development Redis..."
	docker compose exec redis redis-cli

# Production migration commands
alembic-migrate:
	@echo "Creating versions directory if it doesn't exist..."
	@kubectl exec $(POD_NAME) -- mkdir -p /app/alembic/versions
	@echo "Generating migration..."
	$(call exec_alembic,python -m alembic revision --autogenerate -m "$(filter-out $@,$(MAKECMDGOALS))")
	@echo "Applying migration..."
	$(call exec_alembic,python -m alembic upgrade head)
	@echo "Migration completed successfully!"

alembic-head:
	@echo "Upgrading to latest version..."
	$(call exec_alembic,python -m alembic upgrade head)

alembic-base:
	@echo "Downgrading to base version..."
	$(call exec_alembic,python -m alembic downgrade base)

alembic-up:
	@echo "Upgrading one version..."
	$(call exec_alembic,python -m alembic upgrade +1)

alembic-down:
	@echo "Downgrading one version..."
	$(call exec_alembic,python -m alembic downgrade -1)

alembic-recreate:
	@echo "Recreating database schema..."
	$(call exec_alembic,python -m alembic downgrade base)
	$(call exec_alembic,python -m alembic upgrade head)

# This allows passing arguments to the migrate targets
%:
	@: 