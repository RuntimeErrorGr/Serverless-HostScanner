FROM python:3.11-alpine

WORKDIR /code
COPY port_scanner/requirements.txt .

RUN apk update && apk add --no-cache nmap && apk add --no-cache nmap-scripts \
    && apk add --no-cache --virtual build-deps gcc musl-dev linux-headers \
    && pip install --no-cache-dir -r requirements.txt \
    && apk del build-deps

COPY port_scanner/top_ports/* ./
COPY port_scanner/check_targets.py .
COPY port_scanner/check_targets_utils.py .

RUN chmod +x check_targets.py
RUN mkdir /code/logs

ENTRYPOINT ["./check_targets.py"]
