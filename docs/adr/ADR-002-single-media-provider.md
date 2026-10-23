# ADR-002 Single media provider

Status: accepted

FRD named both Cloudinary and Object Store. One `MediaStorageProvider` is authoritative. Default local disk for demo; S3-compatible for production. DIM remains a separate optional document adapter.
