import os

def asset_path(asset):
    return os.path.join(os.path.join(os.path.dirname(__file__), "../assets"), asset)


def open_asset(asset):
    path = asset_path(asset)
    return open(path, "r")


def read_asset(asset):
   file = open_asset(asset)
   return file.read()