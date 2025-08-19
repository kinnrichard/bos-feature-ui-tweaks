# Windows Setup Guide

## Git Bash Script Compatibility

If you encounter "bad interpreter: No such file or directory" when running bash scripts:

### Quick Fix
Run this command in Git Bash as Administrator:
```bash
ln -s $(which env) /usr/bin/env
```

### Alternative Methods
If you can't create the symlink, run scripts explicitly with bash:
```bash
bash bin/db-backup
bash bin/dev
```

### Why This Happens
- Unix scripts use `#!/usr/bin/env bash` to find bash in your PATH
- Git Bash doesn't always have `/usr/bin/env` by default
- The symlink creates this standard Unix path

### WSL Users
This issue doesn't affect WSL - scripts should work normally there.