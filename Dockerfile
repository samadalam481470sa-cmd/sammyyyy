# Runs the multi-user Job Finder web service 24/7.
#
#   docker build -t job-finder .
#   docker run -d --name job-finder -p 3000:3000 \
#     -v job-finder-data:/app/job-finder/users \
#     -e RUN_INTERVAL_HOURS=6 \
#     job-finder
#
# The named volume persists uploaded resumes and results across restarts.
# No npm dependencies — the app uses only the Node standard library.
FROM node:20-alpine

WORKDIR /app
COPY . .

# Resume uploads and per-user outputs live here; mount a volume to persist.
VOLUME ["/app/job-finder/users"]

ENV PORT=3000 \
    RUN_INTERVAL_HOURS=6

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "web/server.js"]
