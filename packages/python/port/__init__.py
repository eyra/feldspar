def __getattr__(name):
    if name == "start":
        from port.main import start
        return start
    raise AttributeError(f"module 'port' has no attribute {name!r}")


__all__ = ["start"]
