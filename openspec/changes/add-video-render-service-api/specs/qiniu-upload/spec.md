## ADDED Requirements

### Requirement: Upload rendered MP4 to Qiniu

After a successful Remotion render, the system MUST upload the MP4 bytes to the configured Qiniu bucket and expose the public CDN URL as the job `video_url`. Upload credentials MUST come from server environment variables and MUST NOT be embedded in client bundles.

#### Scenario: Upload succeeds

- **WHEN** a local MP4 exists for a job and Qiniu is configured
- **THEN** the object is uploaded under a deterministic key prefix including the job id
- **AND** `video_url` equals the CDN URL for that key

#### Scenario: Qiniu not configured

- **WHEN** required `QINIU_*` variables are missing at upload time
- **THEN** the job fails with a clear configuration error
- **AND** does not mark the job `done`

#### Scenario: Upload HTTP failure

- **WHEN** Qiniu rejects the upload
- **THEN** the job status becomes `failed`
- **AND** the error message includes enough detail for operators to diagnose
