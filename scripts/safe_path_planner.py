import heapq
import cv2
import numpy as np

# 0 = clear, 1 = obstacle
grid = np.array([
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,0,0,1,1,0],
    [0,1,1,0,1,0,0,0,1,0],
    [0,0,0,0,0,0,1,0,1,0],
    [0,1,1,1,1,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,1,0],
    [0,1,1,0,0,0,0,0,1,0],
    [0,0,0,0,0,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
])

start = (0, 0)
person = (8, 9)


def heuristic(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def astar(grid, start, goal):
    rows, cols = grid.shape

    queue = [(0, start)]
    came_from = {}
    cost = {start: 0}

    directions = [
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),
    ]

    while queue:
        _, current = heapq.heappop(queue)

        if current == goal:
            path = []

            while current != start:
                path.append(current)
                current = came_from[current]

            path.append(start)
            return path[::-1]

        for dr, dc in directions:
            nr = current[0] + dr
            nc = current[1] + dc

            if not (0 <= nr < rows and 0 <= nc < cols):
                continue

            if grid[nr, nc] == 1:
                continue

            neighbour = (nr, nc)
            new_cost = cost[current] + 1

            if neighbour not in cost or new_cost < cost[neighbour]:
                cost[neighbour] = new_cost
                priority = new_cost + heuristic(neighbour, goal)

                heapq.heappush(
                    queue,
                    (priority, neighbour)
                )

                came_from[neighbour] = current

    return None


path = astar(grid, start, person)

if path is None:
    print("No safe route found.")
    raise SystemExit

print("Person detected at:", person)
print("Safe route:")
print(path)

# Visualize
scale = 60
image = np.ones(
    (grid.shape[0] * scale, grid.shape[1] * scale, 3),
    dtype=np.uint8
) * 255

for r in range(grid.shape[0]):
    for c in range(grid.shape[1]):

        if grid[r, c] == 1:
            cv2.rectangle(
                image,
                (c * scale, r * scale),
                ((c + 1) * scale, (r + 1) * scale),
                (80, 80, 80),
                -1,
            )

for r, c in path:
    cv2.rectangle(
        image,
        (c * scale + 15, r * scale + 15),
        ((c + 1) * scale - 15, (r + 1) * scale - 15),
        (0, 200, 0),
        -1,
    )

sr, sc = start
pr, pc = person

cv2.circle(
    image,
    (sc * scale + scale // 2, sr * scale + scale // 2),
    15,
    (255, 0, 0),
    -1,
)

cv2.circle(
    image,
    (pc * scale + scale // 2, pr * scale + scale // 2),
    15,
    (0, 0, 255),
    -1,
)

cv2.imwrite(
    "runs/poc/safe_route.png",
    image
)

print("Saved: runs/poc/safe_route.png")
