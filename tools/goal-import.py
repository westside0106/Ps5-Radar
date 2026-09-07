import base64
import hashlib
import io
import json
import pathlib
import subprocess
import tarfile

root = pathlib.Path.cwd().resolve()
payload = json.loads((root / 'tools/goal-payload.json').read_text())
assert payload['base'] == '7b15aa43d939eae3a26856bdad3665147a39a01d'


def digest(data):
    return hashlib.sha256(data).hexdigest()


parts = []
for name, expected, size in zip(payload['parts'], payload['partSha256'], payload['partLengths'], strict=True):
    path = root / name
    raw = path.read_bytes()
    if digest(raw) != expected:
        # Recover one accidental insertion only when the exact original hash matches.
        assert len(raw) == size + 1, f'{name}: unexpected length'
        repaired = None
        for offset in range(len(raw)):
            candidate = raw[:offset] + raw[offset + 1:]
            if digest(candidate) == expected:
                repaired = candidate
                break
        assert repaired is not None, f'{name}: checksum mismatch cannot be repaired'
        raw = repaired
        path.write_bytes(raw)
        print(f'Restored exact archive part: {name}')
    assert len(raw) == size and digest(raw) == expected
    parts.append(raw)

data = base64.b64decode(b''.join(parts), validate=True)
assert digest(data) == payload['sha256'], 'Full archive checksum mismatch'

allowed = ('app/', 'lib/', 'scripts/', 'docs/')
exact = {'package.json', 'README.md', 'data/ps-plus-catalog.json', 'data/game-sources.json'}


def safe(name):
    path = pathlib.PurePosixPath(name)
    assert name and not name.startswith('/') and '..' not in path.parts
    assert name in exact or any(name.startswith(prefix) for prefix in allowed)
    assert not name.startswith(('app/api/', '.github/', 'scripts/automation-', 'scripts/goal-'))
    return name


with tarfile.open(fileobj=io.BytesIO(data), mode='r:xz') as archive:
    patches = []
    files = []
    for member in archive.getmembers():
        assert member.isfile() and member.size < 2000000
        if member.name == 'goal-manifest.json':
            continue
        if member.name.startswith('patches/') and member.name.endswith('.patch'):
            safe(member.name[len('patches/'):-6])
            patches.append(archive.extractfile(member).read())
        elif member.name.startswith('files/'):
            name = safe(member.name[len('files/'):])
            files.append((name, archive.extractfile(member).read()))
        else:
            raise ValueError(f'Unexpected archive member: {member.name}')
    patch = b'\n'.join(patches)
    if patch:
        subprocess.run(['git', 'apply', '--check', '-'], input=patch, check=True)
        subprocess.run(['git', 'apply', '-'], input=patch, check=True)
    for name, content in files:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

print(f'Imported {len(patches)} patches and {len(files)} files. Daily data and main were not modified.')
