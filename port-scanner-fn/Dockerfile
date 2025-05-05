ARG PYTHON_VERSION=3.12
ARG DEBIAN_OS=slim-bookworm

FROM --platform=${TARGETPLATFORM:-linux/amd64} ghcr.io/openfaas/of-watchdog:0.10.7 AS watchdog
FROM --platform=${TARGETPLATFORM:-linux/amd64} python:${PYTHON_VERSION}-${DEBIAN_OS} AS build

COPY --from=watchdog /fwatchdog /usr/bin/fwatchdog
RUN chmod +x /usr/bin/fwatchdog

ARG ADDITIONAL_PACKAGE
ARG UPGRADE_PACKAGES=false

RUN apt-get update -qy \
    && if [ "${UPGRADE_PACKAGES}" = "true" ] || [ "${UPGRADE_PACKAGES}" = "1" ]; then apt-get upgrade -qy; fi \
    && apt-get install -qy --no-install-recommends gcc make ${ADDITIONAL_PACKAGE} \
    && rm -rf /var/lib/apt/lists/*

# Add non-root user
RUN addgroup --system app \
    && adduser app --system --ingroup app --home /home/app \
    && chown app:app /home/app

WORKDIR /home/app/

COPY index.py           .
COPY requirements.txt   .

RUN pip install --no-cache-dir -r requirements.txt

# Setup Python package structure
RUN mkdir -p function
RUN touch ./function/__init__.py
WORKDIR /home/app/function/

COPY function/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY function/ .

FROM build AS test
ARG TEST_COMMAND=tox
ARG TEST_ENABLED=true
RUN [ "$TEST_ENABLED" = "false" ] && echo "skipping tests" || eval "$TEST_COMMAND"

FROM build AS ship
WORKDIR /home/app/

USER root

ENV fprocess="python index.py"
ENV cgi_headers="true"
ENV mode="http"
ENV upstream_url="http://127.0.0.1:5000"

HEALTHCHECK --interval=5s CMD [ -e /tmp/.lock ] || exit 1

CMD ["fwatchdog"]
