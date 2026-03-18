"""An open implementation of PifPaf."""

import sys
# Checkpoint .pkl was saved with module name 'openpifpaf'; alias so torch.load can unpickle.
if 'openpifpaf' not in sys.modules:
    sys.modules['openpifpaf'] = sys.modules[__name__]

from ._version import get_versions
__version__ = get_versions()['version']
del get_versions

from .annotation import Annotation, AnnotationDet
from . import datasets
from . import decoder
from . import network
from . import optimize
