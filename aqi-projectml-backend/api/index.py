import os
import sys

# Vercel may import this module with the function directory as sys.path[0].
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app import app

# Vercel Python serverless entrypoint
# The Flask app is imported from the project root app.py file.
# The platform invokes this module and routes HTTP requests through the Flask app.

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
