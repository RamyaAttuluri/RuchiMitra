"""Explicit download step, separate from inference. Requires authorized HF access for gated assets."""
import argparse
import re
from huggingface_hub import snapshot_download

parser = argparse.ArgumentParser()
parser.add_argument('model', choices=['indicf5', 'indictrans2'])
parser.add_argument('revision', help='Full reviewed 40-character upstream commit ID')
parser.add_argument('destination')
args = parser.parse_args()
if not re.fullmatch('[a-f0-9]{40}', args.revision):
    parser.error('Use an immutable commit revision, not a branch name')
repo = {'indicf5': 'ai4bharat/IndicF5', 'indictrans2': 'ai4bharat/indictrans2-en-indic-dist-200M'}[args.model]
snapshot_download(repo_id=repo, revision=args.revision, local_dir=args.destination)
print('Downloaded. Review custom Python and licenses before starting inference:', args.destination)
