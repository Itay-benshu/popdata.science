import pandas as pd
import numpy as np
import glob
import os
import json
SEGMENT_SIZE = 20
ROLL_MINS = 3
# Path to folder with .mp4 and .srt files
folder = '/Users/Itay/Desktop/birdman'
# Movie title
label = 'Birdman'
# Plot color
color = 'blue'


# Part 1: reading subtitle file, clearing timing lines, and splitting to words/min dataframe

# Get path to subtitle and movie file using glob with suffix search
sub_file_path = glob.glob(os.path.join(folder, '*.srt'))[0]
movie_file_path = glob.glob(os.path.join(folder, '*.mp4'))[0]

# Read subtitle file
# Structure of file is:
# ...
# <LINE_NUMBER>
# <TIMING>
# <TEXT (Possibly multi lined)>
# <EMPTY LINE>
# ...
with open(sub_file_path, encoding='utf-8', errors='ignore') as handle:
    content = handle.readlines()

# Find the indices of the empty rows ( == '\n') using numpy where,
# and split the original array to "blocks" representing each subtitle appearance
# +1 is added to the split indices so that each block starts with the line number and ends with the separator
sub_blocks = np.split(content, np.where(np.array(content) == '\n')[0] + 1)

# Iterate the sub blocks, position 1 is the timing line, position 2 and forward is the content.
# Create an array of dictionaries,
# containing the text (join of all content lines), and the rounded minute (read from timing line)
sub_min_text = [{'min':int(x[1].split(':')[1]) + 60 * int(x[1].split(':')[0]),
               'text':" ".join(x[2:])} for x in sub_blocks if len(x) > 0]

# Build DataFrame
sub_df = pd.DataFrame(sub_min_text)

# Part two - counting words per minute, rolling to smooth graph, and finding maximas

# Calculate total words per subtitle block
sub_df['total_words'] = sub_df['text'].apply(lambda x: len(x.split()))

# for minutes without subtitle blocks at all.
# Roll the dataframe based on ROLL_MINS so that the output is less noisy, the value of every minute is now calculated
# As a mean

# Group the dataframe based on subtitle minute, and get sum of total_words per group
per_min_df = \
    pd.DataFrame(sub_df.groupby(by='min').sum()['total_words']
    # Reindex the dataframe for a minute based index (0 to last-min)
    # this is used so we'll also have a representation for minutes without any subtitle blocks
    .reindex(np.arange(0, np.max(sub_df['min'])))
    # therefore the next step is to fill those empty indices with 0 total words
    .fillna(0)
    # Roll the dataframe based on roll mins, making the output less noisy
    .rolling(ROLL_MINS)
    # Solve the roll using mean value - every minutes "total words" will now be
    # the average total words of the last ROLL_MINS
    .mean().fillna(0))

# Use np.roll measure see the backwards change (current - previous) in total words
# and the forwards change in total words (next - current)
change_pre = per_min_df['total_words'] - np.roll(per_min_df['total_words'], 1)
change_post = np.roll(per_min_df['total_words'], -1) - per_min_df['total_words']

# Find maximum and minimum points, define extrema points as either one
maxima = (change_pre > 0) & (change_post < 0)
minima = (change_pre < 0) & (change_post > 0)
extrema_points = (maxima) | (minima)

# Create DF for extrema points, calculate distance of every extrema from the mean words
extrema_df = pd.DataFrame(np.abs(per_min_df.loc[extrema_points, 'total_words'] - per_min_df['total_words'].mean()))

# Chunk into segments, group by the segments and get index of extrema that's farthest away from the mean
extrema_df['segment'] = (np.array(extrema_df.index) / SEGMENT_SIZE).astype(int)
segmented_extrema = extrema_df.groupby('segment').agg(segment_top_extrema_min=('total_words', np.argmax))

# Information for plot, x y for line and x y for each extrema dot
line_x = list(per_min_df.index)
line_y = per_min_df['total_words']
extrema_x = segmented_extrema['segment_top_extrema_min']
extrema_y = per_min_df.loc[segmented_extrema['segment_top_extrema_min'], 'total_words']

# Part three - clip extraction and exports

# Create folder if doesn't exist
plot_data_path = os.path.join('./plot_data', label)
if not os.path.exists(plot_data_path):
    os.mkdir(plot_data_path)

# Iterate the extremas, for each one call FFMPEG with
# 1. second of clip start
# 2. path to mp4 file
# 3. length of clip (1 min)
# 4. path to output file
for peak_min in list(segmented_extrema['segment_top_extrema_min']):
    os.system('ffmpeg -y -ss {} -i "{}" -t {} -c:v libx264 -x264-params "nal-hrd=cbr" -b:v 1M -minrate 1M -maxrate 1M -bufsize 2M "{}.mp4"'
              .format((peak_min)* 60 ,
                      movie_file_path,
                      1 * 60,
                      os.path.join(plot_data_path, str(int(peak_min)))))

# Dump all data for plotting in client
json.dump({'line_x':list(line_x),
            'line_y':list(line_y),
            'extrema_x':list(extrema_x),
            'extrema_y':list(extrema_y),
            'name': label,
            'color': color,
            'path':plot_data_path},
          open(os.path.join(plot_data_path, 'out.json'), 'w'))