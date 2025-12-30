COMPOSE ?= docker compose

.PHONY: start stop rebuild

start:
	$(COMPOSE) up -d

stop:
	$(COMPOSE) down

rebuild:
	$(COMPOSE) down
	$(COMPOSE) up -d --build
